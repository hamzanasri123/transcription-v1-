const express = require('express');
const multer = require('multer');
const controller = require('./controller');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/', controller.getHomePage);
router.post('/transcrire', upload.single('video'), controller.transcrireVideo);

module.exports = router;
