const express = require('express');
const controller = require('../controllers/presaController');

const router = express.Router();

router.get('/', controller.getPrese);
router.get('/:presaId', controller.getPresa);
router.post('/', controller.postPresa);
router.patch('/:presaId', controller.patchPresa);
router.delete('/:presaId', controller.deletePresa);

module.exports = router;