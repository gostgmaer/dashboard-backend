const {
    jwtSecret,
    refressSecret,
  } = require("../config/setting");
  const jwt = require("jsonwebtoken");




const generateTokens = (user) => { 

    const {
        firstName,
        lastName,
        username,
        email,
        address,
        profilePicture,
        
        phoneNumber,
        role,
        id,
      } = user;

    const accessToken = jwt.sign(
        {
          id,
          role: role,
          email,
          username,
            image: profilePicture||"https://avatar.iran.liara.run/public/8",
          name: firstName + " " + lastName,
        },
        jwtSecret,
        {
          expiresIn: "1d",
        }
      );

      // Generate a refresh token (for extended sessions)

      const refreshToken = jwt.sign(
        { username, userId: id },
        refressSecret,
        {
          expiresIn: "7d",
        }
      );

      const id_token = jwt.sign(
        {
          firstName,
          lastName,
          username,
          email,
          id,
          address,
          profilePicture:profilePicture||"https://avatar.iran.liara.run/public/8",
            image: profilePicture||"https://avatar.iran.liara.run/public/8",
          phoneNumber,
        },
        refressSecret,

        {
          expiresIn: "30d",
        }
      );


      return {
        id_token,refreshToken,accessToken
      }


 }


 const setCookiesOnHeader = (accessToken,refreshToken,id_token,res)=>{
    // const {accessToken,refreshToken,id_token} = generateTokens(user)
    

    res.cookie("accessToken", accessToken, {
        path: "/",
        httpOnly: true,
      });
      res.cookie("refreshToken", refreshToken, {
        path: "/",
        httpOnly: true,
      });
      res.cookie("idToken", id_token, { path: "/", httpOnly: true });
 }


 module.exports = {
    generateTokens,setCookiesOnHeader
  };
  