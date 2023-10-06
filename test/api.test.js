const supertest = require('supertest');
const chai = require('chai');
const app = require('../app');  
const sinon = require('sinon');
const { SpeechClient } = require('@google-cloud/speech');
const expect = chai.expect;
const request = supertest(app);

describe('Tests pour l\'API de transcription', function() {

    it('GET / devrait retourner la page HTML', function(done) {
        request.get('/')
               .expect('Content-Type', /html/)
               .expect(200, done);
    });

    it('POST /transcrire sans vidéo devrait retourner 400', function(done) {
        request.post('/transcrire')
               .expect(400)
               .end((err, res) => {
                   expect(res.text).to.equal('Pas de fichier envoyé.');
                   done();
               });
    });

    // Ici, vous pourriez ajouter d'autres tests, par exemple pour tester l'upload d'un fichier vidéo valide et vérifier la réponse.
    // Cependant, cela pourrait nécessiter la mise en place d'un mock pour l'API Google Cloud Speech-to-Text ou la vérification que vous ne vous faites pas facturer pour chaque test d'upload.

    // it.only ou it.skip peuvent être utilisés ici pour focaliser ou ignorer certains tests, comme discuté précédemment.

});


describe('Tests pour l\'API de transcription', function() {

    // Ce bloc before est exécuté avant les tests pour mettre en place le mock
    before(function() {
        // Mock de la méthode `longRunningRecognize` de l'API Google Cloud Speech-to-Text
        sinon.stub(SpeechClient.prototype, 'longRunningRecognize').returns([
            {
                promise: () => [
                    {
                        results: [
                            {
                                alternatives: [
                                    { transcript: "Transcription mockée" }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]);
    });

    // Ce bloc after est exécuté après les tests pour restaurer le comportement original
    after(function() {
        sinon.restore();
    });

   /*  it('POST /transcrire avec une vidéo valide devrait retourner une transcription', function(done) {
        request.post('/transcrire')
               .attach('video', 'exemple.mp4')
               .expect(200)
               .end((err, res) => {
                if(err){
                    console.error(err);
                    return done(err)
                }
                   expect(res.body.message).to.equal('Transcription réussie');
                   expect(res.body.transcription).to.equal('Transcription mockée');
                   done();
               });
    }); */
   /*  it('POST /transcrire avec une vidéo valide devrait retourner une transcription', async function() {
        const res = await request.post('/transcrire').attach('video', 'exemple.mp4').expect(200);
        
        expect(res.body.message).to.equal('Transcription réussie');
        expect(res.body.transcription).to.equal('Transcription mockée');
    });
  */

   
});