const jwt = require("jsonwebtoken");

// Middleware to verify the authentication token privded in the request cookies.
const verifyToken = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res
      .status(403)
      .send({ msg: "A token is required for authentication" });
  }

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_KEY);
    req.user = decoded;
  } catch (err) {
    return res.status(401).send({ msg: "Invalid Token" });
  }
  return next();
};

module.exports = verifyToken;
