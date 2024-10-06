const { ObjectId } = require("mongodb");
const userdb = require("../models/users.js");

// Middleware to check if the user can make the request based on their user type (i.e., Standard user, Moderator user, Admin user)
const required = (level) => {
  return async (req, res, next) => {
    const { userid } = req.user;
    const user = await userdb.search({ _id: new ObjectId(userid) });

    if (user.userType < level) {
      return res
        .status(403)
        .send({ msg: "User is unauthorized to make this request." });
    }

    req.user = user;
    return next();
  };
};

module.exports = {
  required,
};
