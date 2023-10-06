const { SpeechClient } = require('@google-cloud/speech');
const { Storage } = require('@google-cloud/storage');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');



ffmpeg.setFfmpegPath(ffmpegPath);

exports.getHomePage = (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
};
exports.transcrireVideo = async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Pas de fichier envoyé.');
    }
    const languageCode = req.body.lang || 'en-US'
    console.log(languageCode);
    if (!fs.existsSync(path.join(__dirname, 'transcriptions'))) {
        fs.mkdirSync(path.join(__dirname, 'transcriptions'));
    }


    const gcs = new Storage({
        projectId: "cogent-osprey-336709",
        keyFilename: path.join(__dirname, "cogent-osprey-336709-f424dc67d60c.json")
    });
    const bucketName = 'mybuckettranscvide';
    const filename = `uploads/${Date.now()}-${req.file.originalname}`;
    const bucket = gcs.bucket(bucketName);
    const blob = bucket.file(filename);
    const blobStream = blob.createWriteStream();

    blobStream.on('finish', async () => {
        console.log("Fichier .mp4 uploadé avec succès.");

        const audioOutput = path.join(__dirname, 'temp_audio.wav');
        console.log("Début de la conversion avec FFmpeg.");

        ffmpeg()
            .input(blob.createReadStream())
            .audioCodec('pcm_s16le') 
            .audioFrequency(44100)   
            .audioChannels(1)        
            .toFormat('wav')
            .on('end', async () => {
                console.log("Conversion terminée. Début de l'upload du .wav vers GCS.");

                const blobWav = bucket.file(filename.replace('.mp4', '.wav'));
                const blobWavStream = blobWav.createWriteStream();

                blobWavStream.on('finish', async () => {
                    console.log("Fichier .wav uploadé avec succès dans GCS.");

                    const gcsUri = `gs://${bucketName}/${filename.replace('.mp4', '.wav')}`;
                    const speechClient = new SpeechClient({
                        projectId: "cogent-osprey-336709",
                        keyFilename: path.join(__dirname, "cogent-osprey-336709-f424dc67d60c.json")
                    });
                    const config = {
                        encoding: 'LINEAR16',
                        sampleRateHertz: 44100,
                        languageCode: languageCode,
                    };
                    const audio = {
                        uri: gcsUri,
                    };
                    const request = {
                        config: config,
                        audio: audio,
                    };

                    try {
                        const [operation] = await speechClient.longRunningRecognize(request);
                        const [response] = await operation.promise();

                        const transcription = response.results.map(result => result.alternatives[0].transcript).join('\n');
                        const transcriptionPath = path.join(__dirname, 'transcriptions', `${Date.now()}.txt`);
                        fs.writeFileSync(transcriptionPath, transcription);
                        fs.unlinkSync(audioOutput);
                        return res.status(200).json({
                            message: "Transcription réussie",
                            transcriptionPath: transcriptionPath,
                            transcription: transcription
                        });
                    } catch (err) {
                        fs.unlinkSync(audioOutput);
                        return res.status(500).send('Erreur lors de la transcription : ' + err.message);
                    }
                });

                blobWavStream.on('error', (err) => {
                    console.error("Erreur lors de l'upload du fichier .wav:", err);
                    return res.status(500).send('Erreur lors de lupload du fichier .wav: ' + err.message);
                });

                fs.createReadStream(audioOutput).pipe(blobWavStream);
            })
            .on('error', (err) => {
                console.error("Erreur lors de la conversion de la vidéo en audio:", err);
                return res.status(500).send('Erreur lors de la conversion de la vidéo en audio : ' + err.message);
            })
            .save(audioOutput);
    });

    blobStream.on('error', (err) => {
        console.error("Erreur lors de l'upload du fichier .mp4:", err);
        return res.status(500).send('Erreur lors de upload du fichier .mp4: ' + err.message);
    });

    blobStream.end(req.file.buffer);
};
