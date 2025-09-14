const {
    
    applicaionName,
    host,
    confirmPath,
    resetPath,loginPath
  } = require("../config/setting");
  const createMailOptions = require("./mailOptions");
  const transporter = require("./mailTransporter");

const socialSignupBody = (user) => { 

    let mailBody = {
        body: {
          name: user.fullName,
          intro: `Welcome to ${applicaionName}! We are excited to have you on board.`,
          additionalInfo: `Thank you for choosing ${applicaionName}. You now have access to our premium features, including unlimited storage and priority customer support.`,
          action: {
            instructions: `To get started with ${applicaionName}, please click here:`,
            button: {
              color: "#22BC66", // Optional action button color
              text: "Login Your Account",
               link: `${host}/${loginPath}`,
            },
          },
          outro:
            "Need help, or have questions? Just reply to this email, we'd love to help.",
        },
      };
      transporter
        .sendMail(
          createMailOptions(
            "salted",
            user.email,
            `Welcome to ${applicaionName}`,
            mailBody
          )
        )




 }













module.exports = {
    socialSignupBody
  };
  