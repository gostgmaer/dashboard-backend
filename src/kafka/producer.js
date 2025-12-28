const kafka = require('../config/kafka');
const producer = kafka.producer();

module.exports = {
  connectProducer: async () => {
    await producer.connect();
    console.log('User Service Producer connected');
  },

  sendMessage: async (topic, message) => {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  },
};
