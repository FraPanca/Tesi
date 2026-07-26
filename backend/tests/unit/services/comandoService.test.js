jest.mock('../../../src/mqtt/client', () => ({ inviaComando: jest.fn() }));
jest.mock('../../../src/repositories/presaRepository');

const mqttClient = require('../../../src/mqtt/client');
const presaRepository = require('../../../src/repositories/presaRepository');
const comandoService = require('../../../src/services/comandoService');


describe('comandoService.inviaComando', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rifiuta un\'azione diversa da "on"/"off" con ServiceError 400, senza toccare MQTT o il repository', async () => {
    await expect(comandoService.inviaComando('presa1', 'toggle')).rejects.toMatchObject({
      status: 400,
    });

    expect(presaRepository.findByPresaId).not.toHaveBeenCalled();
    expect(mqttClient.inviaComando).not.toHaveBeenCalled();
  });

  test('lancia ServiceError 404 se la presa non esiste', async () => {
    presaRepository.findByPresaId.mockResolvedValue(null);

    await expect(comandoService.inviaComando('sconosciuta', 'on')).rejects.toMatchObject({
      status: 404,
    });
    expect(mqttClient.inviaComando).not.toHaveBeenCalled();
  });

  test('pubblica il comando su MQTT con l\'ip della presa e poi aggiorna lo stato ottimisticamente', async () => {
    presaRepository.findByPresaId.mockResolvedValue({ presaId: 'presa1', ip: '192.168.1.50' });
    mqttClient.inviaComando.mockResolvedValue();
    presaRepository.updateByPresaId.mockResolvedValue({ presaId: 'presa1', stato: 'off' });

    await comandoService.inviaComando('presa1', 'off');

    expect(mqttClient.inviaComando).toHaveBeenCalledWith('presa1', '192.168.1.50', 'off');
    expect(presaRepository.updateByPresaId).toHaveBeenCalledWith('presa1', { stato: 'off' });
  });

  test('se la pubblicazione MQTT fallisce, propaga l\'errore e NON aggiorna lo stato in Mongo', async () => {
    presaRepository.findByPresaId.mockResolvedValue({ presaId: 'presa1', ip: '192.168.1.50' });
    mqttClient.inviaComando.mockRejectedValue(new Error('Pubblicazione fallita dopo i retry'));

    await expect(comandoService.inviaComando('presa1', 'on')).rejects.toThrow('Pubblicazione fallita dopo i retry');
    expect(presaRepository.updateByPresaId).not.toHaveBeenCalled();
  });
});