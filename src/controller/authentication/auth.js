const { ReasonPhrases, StatusCodes } = require('http-status-codes');
const { jwtSecret, refressSecret, applicaionName, host, confirmPath, resetPath, loginPath } = require('../../config/setting');
const User = require('../../models/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sessionStore = require('../../db/sessionConnact');
const createMailOptions = require('../../email/mailOptions');
const transporter = require('../../email/mailTransporter');
const { generateTokens, setCookiesOnHeader } = require('../../lib/service');

const signUp = async (req, res) => {
  const { firstName, lastName, email, password, username } = req.body;
  if (!firstName || !lastName || !email || !password || !username) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Please Provide Required Information',
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
    });
  }

  const hash_password = await bcrypt.hash(password, 10);

  const userData = {
    firstName,
    lastName,
    email,
    hash_password,
    username,
  };

  const user = await User.findOne({ email });
  const userId = await User.findOne({ username });

  if (user) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: `User with email ${user.email} already registered`,
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
    });
  } else if (userId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: `Username ${userId.username} is already taken`,
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
    });
  } else {
    const token = jwt.sign(
      {
        email: userData.email,
      },
      jwtSecret,
      {
        expiresIn: '1h',
      }
    );
    User.create({
      ...userData,
      confirmToken: token,
      isEmailconfirm: false,
    }).then((data, err) => {
      if (err)
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: err.message,
          statusCode: StatusCodes.BAD_REQUEST,
          status: ReasonPhrases.BAD_REQUEST,
        });
      else {
        let mailBody = {
          body: {
            name: data.fullName,
            intro: `Welcome to ${applicaionName}! We are excited to have you on board.`,
            additionalInfo: `Thank you for choosing ${applicaionName}. You now have access to our premium features, including unlimited storage and priority customer support.`,
            action: {
              instructions: `To get started with ${applicaionName}, please click here:`,
              button: {
                color: '#22BC66', // Optional action button color
                text: 'Login Your Account',
                link: `${host}/${loginPath}`, 
              },
            },
            outro: "Need help, or have questions? Just reply to this email, we'd love to help.",
          },
        };
        transporter
          .sendMail(createMailOptions('salted', data.email, `Welcome to ${applicaionName} - Check Your Account`, mailBody))
          .then(() => {
            res.status(StatusCodes.CREATED).json({
              message: 'User Register Completed Please Login !',
              status: ReasonPhrases.CREATED,
              statusCode: StatusCodes.CREATED,
            });
          })
          .catch((error) => {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
              message: error.message,
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              status: ReasonPhrases.INTERNAL_SERVER_ERROR,
            });
          });
      }
    });
  }
};

const SocialsignUp = async (req, res) => {
  const { firstName, email, username } = req.body;
  if (!firstName || !email || !username) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'Please Provide Required Information',
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
    });
  }

  try {
    var newUser = new User({
      ...req.body,
      isEmailconfirm: true,
      isVerified: true,
      role: 'customer',
    });

    newUser = await newUser.save();

    if (newUser) {
      // socialSignupBody(newUser)
      const {
        firstName,
        lastName,

        email,

        profilePicture,

        id,
      } = newUser;

      const { accessToken, refreshToken, id_token } = generateTokens(newUser);
      res.cookie('accessToken', accessToken, {
        path: '/',
        httpOnly: true,
      });
      res.cookie('refreshToken', refreshToken, {
        path: '/',
        httpOnly: true,
      });
      res.cookie('idToken', id_token, { path: '/', httpOnly: true });

      res.status(StatusCodes.OK).json({
        accessToken,
        token_type: 'Bearer',
        id,
        email,
        image: profilePicture,
        id_token,
        refreshToken,
        name: firstName + ' ' + lastName,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const signIn = async (req, res) => {
  try {
    if (!req.body.email || !req.body.password) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Please enter email and password',
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    } else {
      const user = await User.findOne({ email: req.body.email });

      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({
          message: 'Inavalid User Name!',
          statusCode: StatusCodes.NOT_FOUND,
          status: ReasonPhrases.NOT_FOUND,
        });
      } else {
        const isPasswordValid = await bcrypt.compare(req.body.password, user.hash_password);
        if (!isPasswordValid) {
          res.status(StatusCodes.UNAUTHORIZED).json({
            message: 'Password is invalid!',
            statusCode: StatusCodes.UNAUTHORIZED,
            status: ReasonPhrases.UNAUTHORIZED,
          });
        } else {
          const { firstName, lastName, email, profilePicture, id } = user;

          const { accessToken, refreshToken, id_token } = generateTokens(user);
          res.cookie('accessToken', accessToken, {
            path: '/',
            httpOnly: true,
          });
          res.cookie('refreshToken', refreshToken, {
            path: '/',
            httpOnly: true,
          });
          res.cookie('idToken', id_token, { path: '/', httpOnly: true });

          res.status(StatusCodes.OK).json({
            accessToken,
            token_type: 'Bearer',
            id,
            email,
            image: profilePicture||"https://avatar.iran.liara.run/public/8",
            id_token,
            refreshToken,
            name: firstName + ' ' + lastName,
            statusCode: StatusCodes.OK,
            status: ReasonPhrases.OK,
          });
        }
      }
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const customsignIn = async (req, res) => {
  try {
    if (!req.body.email || !req.body.password) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Please enter email and password',
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    } else {
      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({
          message: 'Inavalid User Name!',
          statusCode: StatusCodes.NOT_FOUND,
          status: ReasonPhrases.NOT_FOUND,
        });
      } else {
        const isPasswordValid = await bcrypt.compare(req.body.password, user.hash_password);
        if (!isPasswordValid) {
          res.status(StatusCodes.UNAUTHORIZED).json({
            message: 'Password is invalid!',
            statusCode: StatusCodes.UNAUTHORIZED,
            status: ReasonPhrases.UNAUTHORIZED,
          });
        } else {
          const { firstName, lastName, username, id } = user;

          const accessToken = jwt.sign(
            {
              role: user.role,
              email: user.email,
              username,
              id,
              name: firstName + ' ' + lastName,
            },
            jwtSecret,
            {
              expiresIn: '1h',
            }
          );

          // Generate a refresh token (for extended sessions)

          res.cookie('accessToken', accessToken, {
            path: '/',
            httpOnly: true,
          });

          res.status(StatusCodes.OK).json({
            accessToken,
            token_type: 'Bearer',
            username,
            id,
            statusCode: StatusCodes.OK,
            status: ReasonPhrases.OK,
          });
        }
      }
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const checkAuth = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({
      email,
    });
    if (user) {
      res.status(StatusCodes.OK).json({
        message: 'User Success',
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
        result: user,
      });
    } else {
      const token = jwt.sign(
        {
          email: email,
        },
        jwtSecret,
        {
          expiresIn: '1h',
        }
      );

      User.create({
        ...req.body,
        confirmToken: token,
        isEmailconfirm: true,
        username: email,
      }).then((data) => {
        res.status(StatusCodes.CREATED).json({
          message: 'User created',
          status: ReasonPhrases.CREATED,
          statusCode: StatusCodes.CREATED,
          result: data,
        });
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const chechUser = async (req, res) => {
  const { email, username } = req.body;

  try {
    const user = await User.findOne({ email });
    const userId = await User.findOne({ username });

    if (user) {
      const { firstName, lastName, email, profilePicture, id } = user;

      // const token = generateTokens(user)

      const { accessToken, refreshToken, id_token } = generateTokens(user);
      setCookiesOnHeader(accessToken, refreshToken, id_token, res);

      res.status(StatusCodes.OK).json({
        accessToken,
        token_type: 'Bearer',
        id,
        email,
        image: profilePicture,
        id_token,
        refreshToken,
        name: firstName + ' ' + lastName,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
      });
    } else if (userId) {
      const { firstName, lastName, email, profilePicture, id } = userId;

      const { accessToken, refreshToken, id_token } = generateTokens(userId);

      res.cookie('accessToken', accessToken, {
        path: '/',
        httpOnly: true,
      });
      res.cookie('refreshToken', refreshToken, {
        path: '/',
        httpOnly: true,
      });
      res.cookie('idToken', id_token, { path: '/', httpOnly: true });

      res.status(StatusCodes.OK).json({
        accessToken,
        token_type: 'Bearer',
        id,
        email,
        image: profilePicture,
        id_token,
        refreshToken,
        name: firstName + ' ' + lastName,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
      });
    } else {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Not Found`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiration: { $gt: Date.now() },
    });

    if (!user) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Invalid or expired token',
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    } else {
      let mailBody = {
        body: {
          name: user.fullName,
          intro: 'Your password has been successfully reset.',
          action: {
            instructions: `You can now log in to your account with your new password.`,
            button: {
              color: '#22BC66', // Optional action button color
              text: 'Login Now',
              link: `${host}/${confirmPath}`,
            },
          },
          outro: 'If you did not request this, please ignore this email and your password will remain unchanged.',
        },
      };
      const hashedPassword = await bcrypt.hash(password, 10); // 10 is the saltRounds
      user.hash_password = hashedPassword;
      user.resetToken = undefined;
      user.resetTokenExpiration = undefined;

      await user.save();

      transporter
        .sendMail(createMailOptions('salted', user.email, `Password reset successfully`, mailBody))
        .then(() => {
          res.status(StatusCodes.OK).json({
            message: 'Password reset successfully',
            statusCode: StatusCodes.OK,
            status: ReasonPhrases.OK,
          });
        })
        .catch((error) => {
          res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: error.message,
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            status: ReasonPhrases.INTERNAL_SERVER_ERROR,
          });
        });
    }

    // Password reset successful
    // return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    // Handle error

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const singout = async (req, res) => {
  try {
    const sessionId = req?.headers?.session_id;
    req.session.destroy((err) => {
      if (err) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          message: err.message,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          status: ReasonPhrases.INTERNAL_SERVER_ERROR,
          cause: err,
        });
      } else {
        // Successfully destroyed the session, now remove it from the database

        sessionStore.destroy(sessionId, (destroyErr) => {
          if (destroyErr) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
              message: destroyErr.message,
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              status: ReasonPhrases.INTERNAL_SERVER_ERROR,
              cause: destroyErr,
            });
          } else {
            // Redirect to a logout success page or another route
            res.status(StatusCodes.OK).json({
              message: 'Logout Success',
              statusCode: StatusCodes.OK,
              status: ReasonPhrases.OK,
            });
          }
        });
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      cause: error,
    });
  }
};

const varifySession = async (req, res) => {
  try {
    const token = req.headers.authorization;

    if (!token || !token.startsWith('Bearer ')) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'Token Not Provided',
        statusCode: StatusCodes.UNAUTHORIZED,
        status: ReasonPhrases.UNAUTHORIZED,
      });
    } else {
      const tokenValue = token.split(' ')[1];
      const decodeduser = jwt.verify(tokenValue, jwtSecret);
      if (!decodeduser) {
        res.status(StatusCodes.FORBIDDEN).json({
          message: 'Authorization Token is Not Valid',
          statusCode: StatusCodes.FORBIDDEN,
          status: ReasonPhrases.FORBIDDEN,
        });
      } else {
        await User.findOne({ _id: decodeduser.user_id }).then((data, err) => {
          if (err) {
            res.status(StatusCodes.UNAUTHORIZED).json({
              message: 'Not Authorised',
              statusCode: StatusCodes.UNAUTHORIZED,
              status: ReasonPhrases.UNAUTHORIZED,
            });
          } else {
            const { firstName, lastName, username, email, address, isVerified, profilePicture, phoneNumber, dateOfBirth, contactNumber } = data;
            const accessToken = jwt.sign(
              {
                user_id: data.id,
                role: data.role,
                email: data.email,
                username: data.username,
              },
              jwtSecret,
              {
                expiresIn: '1d',
              }
            );
            const id_token = jwt.sign(
              {
                firstName,
                lastName,
                username,
                email,
                address,
                isVerified,
                profilePicture,
                contactNumber,
                phoneNumber,
                dateOfBirth,
              },
              refressSecret,

              {
                expiresIn: '30d',
              }
            );
            res.cookie('accessToken', accessToken, {
              path: '/',
              httpOnly: true,
            });
            res.cookie('idToken', id_token, { path: '/', httpOnly: true });

            res.status(StatusCodes.OK).json({
              accessToken,
              id_token,
              message: 'Authorized',
              statusCode: StatusCodes.OK,
              status: ReasonPhrases.OK,
            });
          }
        });
      }
    }

    // Proceed with the protected route logic
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const forgetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({
      email,
    });
    if (!user) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: 'Email address is not registered',
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    } else {
      const resetToken = jwt.sign(
        {
          user_id: user.id,
          role: user.role,
          email: user.email,
        },
        jwtSecret,
        {
          expiresIn: '1h',
        }
      );
      const resetTokenExpiration = Date.now() + 3600000; // 1 hour

      const data = await User.updateOne(
        { email: req.body.email },
        {
          resetToken,
          resetTokenExpiration,
        }
      );
      if (!data) {
        res.status(StatusCodes.BAD_REQUEST).json({
          message: 'Reset password email generation failed',
          statusCode: StatusCodes.BAD_REQUEST,
          status: ReasonPhrases.BAD_REQUEST,
        });
      } else {
        let mailBody = {
          body: {
            name: user.fullName,
            intro: 'You are receiving this because you (or someone else) have requested a password reset for your account.',
            action: {
              instructions: `Click on the following link to reset your password:`,
              button: {
                color: '#22BC66', // Optional action button color
                text: 'Reset Password',
                link: `${host}/${resetPath}?token=${resetToken}`,
              },
            },
            outro: 'If you did not request this, please ignore this email and your password will remain unchanged.',
          },
        };

        transporter
          .sendMail(createMailOptions('salted', user.email, `Password reset request`, mailBody))
          .then(() => {
            res.status(StatusCodes.OK).json({
              message: 'Password reset email has been sent successfully. Please check your mailbox',
              statusCode: StatusCodes.OK,
              status: ReasonPhrases.OK,
            });
          })
          .catch((error) => {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
              message: error.message,
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              status: ReasonPhrases.INTERNAL_SERVER_ERROR,
            });
          });
      }
    }
  } catch (error) {
    // Handle error

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const accountConfirm = async (req, res) => {
  try {
    const { token } = req.params;

    const decodeduser = jwt.verify(token, jwtSecret);
    if (!decodeduser) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Invalid or expired token',
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    } else {
      const user = await User.findOne({
        _id: decodeduser.id,
      });
      if (!user) {
        res.status(StatusCodes.BAD_REQUEST).json({
          message: 'Invalid user Token',
          statusCode: StatusCodes.BAD_REQUEST,
          status: ReasonPhrases.BAD_REQUEST,
        });
      } else if (user.isVerified) {
        res.status(StatusCodes.OK).json({
          message: 'Accoount is Already Verify',
          statusCode: StatusCodes.OK,
          status: ReasonPhrases.OK,
        });
      } else {
        user.isEmailconfirm = true;
        user.isVerified = true;
        user.confirmToken = '';
        await user.save();
        res.status(StatusCodes.OK).json({
          message: 'Accoount Confirm successfully',
          statusCode: StatusCodes.OK,
          status: ReasonPhrases.OK,
        });
      }
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const changedPassword = async (req, res) => {
  try {
    const { password, current_password } = req.body;

    const user = await User.findOne({
      _id: req.params.user,
    });

    if (!user) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Invalid or expired token',
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    } else {
      if (user.hash_password) {
        const isPasswordValid = await bcrypt.compare(current_password, user.hash_password);
        if (!isPasswordValid) {
          res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Current Password is invalid!',
            statusCode: StatusCodes.BAD_REQUEST,
            status: ReasonPhrases.BAD_REQUEST,
          });
        } else {
          const hashedPassword = await bcrypt.hash(password, 10); // 10 is the saltRounds
          user.hash_password = hashedPassword;
          await user.save();
          res.status(StatusCodes.OK).json({
            message: 'Password Changed successfully',
            statusCode: StatusCodes.OK,
            status: ReasonPhrases.OK,
          });
        }
      } else {
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the saltRounds
        user.hash_password = hashedPassword;
        await user.save();
        res.status(StatusCodes.OK).json({
          message: 'Password Changed successfully',
          statusCode: StatusCodes.OK,
          status: ReasonPhrases.OK,
        });
      }
    }
  } catch (error) {
    // Handle error

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const getProfile = async (req, res) => {
  const { user } = req.params;
  if (!user) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: 'user id is not provide',
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
    });
  } else {
    try {
      const userId = await User.findOne({ _id: user }).select(['dateOfBirth', 'gender', 'phoneNumber', 'profilePicture', 'username', 'email','role', 'firstName', 'lastName', 'address', 'isVerified', 'isEmailconfirm','subscriptionStatus','subscriptionType']);

      if (userId.id) {
        return res.status(StatusCodes.OK).json({
          message: `Userdata data Loaded Successfully!`,
          statusCode: StatusCodes.OK,
          status: ReasonPhrases.OK,
          result: userId,
        });
      } else {
        return res.status(StatusCodes.NOT_FOUND).json({
          message: `No information found for given id`,
          statusCode: StatusCodes.NOT_FOUND,
          status: ReasonPhrases.NOT_FOUND,
        });
      }
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: error.message,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      });
    }
  }
};

const getRefreshToken = async (req, res) => {
  try {
    const token = req.body.token || req.body.refreshToken;

    //  const tokenValue = token.split(' ')[1];
    const decodeduser = jwt.verify(token, refressSecret);
    if (!decodeduser) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'Refresh Token is not valid',
        statusCode: StatusCodes.UNAUTHORIZED,
        status: ReasonPhrases.UNAUTHORIZED,
      });
    } else {
      await User.findOne({ _id: decodeduser.userId }, '_id role firstName lastName username email profilePicture contactNumber ').then((newData, err) => {
        if (err) {
          res.status(StatusCodes.UNAUTHORIZED).json({
            message: 'Not Authorized',
            statusCode: StatusCodes.UNAUTHORIZED,
            status: ReasonPhrases.UNAUTHORIZED,
          });
        } else {
          const { firstName, lastName, email, profilePicture, id } = newData;

          const { accessToken, refreshToken, id_token } = generateTokens(newData);
          res.cookie('accessToken', accessToken, {
            path: '/',
            httpOnly: true,
          });
          res.cookie('refreshToken', refreshToken, {
            path: '/',
            httpOnly: true,
          });
          res.cookie('idToken', id_token, { path: '/', httpOnly: true });

          res.status(StatusCodes.OK).json({
            accessToken,
            token_type: 'Bearer',
            id,
            email,
            image: profilePicture,
            id_token,
            refreshToken,
            name: firstName + ' ' + lastName,
            statusCode: StatusCodes.OK,
            status: ReasonPhrases.OK,
          });
        }
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const updateProfile = async (req, res) => {
  const { user } = req.params;
  try {
    var myquery = { _id: user };
    if (user) {
      try {
        User.updateOne(myquery, { $set: req.body }, { upsert: true }).then((data, err) => {
          if (err)
            res.status(StatusCodes.NOT_MODIFIED).json({
              message: 'Update Failed',
              status: ReasonPhrases.NOT_MODIFIED,
              statusCode: StatusCodes.NOT_MODIFIED,
              cause: err,
            });
          else {
            res.status(StatusCodes.OK).json({
              message: 'User Update Successfully',
              status: ReasonPhrases.OK,
              statusCode: StatusCodes.OK,
              data: data,
            });
          }
        });
      } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          message: error.message,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          status: ReasonPhrases.INTERNAL_SERVER_ERROR,
          cause: error,
        });
      }
    } else {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'User does not exist..!',
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      cause: error,
    });
  }
};

module.exports = {
  signUp,
  signIn,
  resetPassword,
  singout,
  varifySession,
  changedPassword,
  forgetPassword,
  accountConfirm,
  getProfile,
  getRefreshToken,
  checkAuth,
  SocialsignUp,
  chechUser,
  customsignIn,
  updateProfile,
};
