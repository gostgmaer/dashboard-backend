const dotenv = require("dotenv");
const Mailgen = require("mailgen");
const {  emailName,applicaionName } = require("../config/setting");
  dotenv.config();

function createMailOptions(theme,to, subject, body) {

  const MailGenerator = new Mailgen({
    theme: theme,
    product: {
      name: applicaionName,
      link: "https://google.com",
    },
  });

  let EmailBody = MailGenerator.generate(body);
  let emailtext = MailGenerator.generatePlaintext(body);

  return {
    from: emailName,
    to: to,
    subject: subject,
    html: EmailBody,
    text: emailtext
  };
}

module.exports = createMailOptions;
