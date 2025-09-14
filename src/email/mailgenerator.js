const Mailgen = require("mailgen");

const MailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: process.env.EMAIL_NAME,
      link: "https://google.com",
    },
  });


let EmailBody = MailGenerator.generate(mailBody);


module.exports = EmailBody;
