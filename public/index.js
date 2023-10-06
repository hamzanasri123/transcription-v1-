require('dotenv').config();

const express = require('express');
const multer = require('multer');
const { SpeechClient } = require('@google-cloud/speech');
const { Storage } = require('@google-cloud/storage');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');


ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = 3000;
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.send("Transcription Demo By Hamza");
});

function attendre(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function telechargerVideo(reqFileBuffer, originalName) {
    try {
        const bucketName = 'mybuckettranscvide';
        const filename = `uploads/${Date.now()}-${originalName}`;
        const gcs = new Storage({
            projectId: process.env.PROJECTID,
            keyFilename: path.join(__dirname, process.env.KEYFILENAME)
        });
        const bucket = gcs.bucket(bucketName);
        const blob = bucket.file(filename);
        const blobStream = blob.createWriteStream();
        blobStream.end(reqFileBuffer);
        return { blob, filename };
    } catch (err) {
        throw new Error("Erreur lors du téléchargement de la vidéo: " + err.message);
    }
}

function convertirVideoEnAudio(blob, filename) {
    const audioOutput = path.join(__dirname, 'temp_audio.wav');
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(blob.createReadStream())
            .audioCodec('pcm_s16le')
            .audioFrequency(44100)
            .audioChannels(1)
            .toFormat('wav')
            .on('end', () => resolve(audioOutput))
            .on('error', (err) => reject(new Error("Erreur lors de la conversion de la vidéo en audio: " + err.message)))
            .save(audioOutput);
    });
}

function telechargerAudio(bucketName, audioOutput, filename) {
    try {
        const blobWav = new Storage().bucket(bucketName).file(filename.replace('.mp4', '.wav'));
        const blobWavStream = blobWav.createWriteStream();
        fs.createReadStream(audioOutput).pipe(blobWavStream);
        return { blobWav, filename };
    } catch (err) {
        throw new Error("Erreur lors du téléchargement du fichier audio: " + err.message);
    }
}

async function transcrireAudio(bucketName, filename) {
    try {
        const gcsUri = `gs://${bucketName}/${filename.replace('.mp4', '.wav')}`;
        const speechClient = new SpeechClient({
            projectId: process.env.PROJECTID,
            keyFilename: path.join(__dirname, process.env.KEYFILENAME)
        });
        const config = {
            encoding: 'LINEAR16',
            sampleRateHertz: 44100,
            languageCode: 'en-US',
        };
        const audio = { uri: gcsUri };
        const request = { config, audio };
        const [operation] = await speechClient.longRunningRecognize(request);
        const [response] = await operation.promise();
        return response.results.map(result => result.alternatives[0].transcript).join('\n');
    } catch (err) {
        throw new Error("Erreur lors de la transcription: " + err.message);
    }
}

app.post('/transcrire', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Pas de fichier envoyé.');
    }

    try {
        const { blob, filename } = await telechargerVideo(req.file.buffer, req.file.originalname);
        await attendre(5000);  // Ajoutez ce délai après le téléchargement et avant la conversion
        const audioOutput = await convertirVideoEnAudio(blob, filename);
        await telechargerAudio('mybuckettranscvide', audioOutput, filename);
        const transcription = await transcrireAudio('mybuckettranscvide', filename);

        const transcriptionPath = path.join(__dirname, 'transcriptions', `${Date.now()}.txt`);
        fs.writeFileSync(transcriptionPath, transcription);
        fs.unlinkSync(audioOutput); // Suppression du fichier audio temporaire

        return res.status(200).json({
            message: "Transcription réussie",
            transcriptionPath: transcriptionPath,
            transcription: transcription
        });
    } catch (err) {
        return res.status(500).send(err.message);
    }
});

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
