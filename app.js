require("dotenv").config();

const express = require("express");
const app = express();
const http = require("http").Server(app);
const helmet = require("helmet"); // Helps secure the application as it sets HTTP headers
const cookieParser = require("cookie-parser");
const multer = require("multer");

// Custom middleware
const auth = require("./middleware/auth.js");
const userLevel = require("./middleware/userLevel.js");

// Import the controllers for handling specific routes
const user = require("./controllers/user.js");
const group = require("./controllers/group.js");
const post = require("./controllers/post.js");
const report = require("./controllers/report.js");
const profile = require("./controllers/profile.js");
const notification = require("./controllers/notification.js");
const messages = require("./controllers/messages.js");

const constants = require("./constants.js");
const upload = multer({ dest: "uploads/" });

const port = process.env.PORT || 3000;

// Applying middleware to all requests
app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: "50mb" })); // Support json encoded bodies

// Simple route for checking the server is infact running
app.get("/hello-world", (_, res) => res.status(200).send("Server is running"));

// LOGIN/REGISTRATION MOD
app.post("/auth/login", user.login);
app.post(
  "/auth/register",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "selfieImage", maxCount: 1 },
  ]),
  user.register
);

// USER MOD
app.get("/user", auth, user.get);
app.get("/myposts", auth, user.getMyPosts);
app.get("/myanonymousposts", auth, user.getMyAnonymousPosts);
app.get("/mybookmarks", auth, user.getMyBookmarks);
app.get("/users", auth, user.getAll);
app.post("/verify/:id", auth, userLevel.required(constants.ADMIN), user.verify);
app.get("/verify", auth, userLevel.required(constants.ADMIN), user.unverified);
app.post(
  "/promote/:id",
  auth,
  userLevel.required(constants.ADMIN),
  user.promote
);
app.post(
  "/downgrade/:id",
  auth,
  userLevel.required(constants.ADMIN),
  user.downgrade
);
app.patch("/user/edit", auth, upload.fields([{ name: "profileImageUrl", maxCount: 1 }]), user.editProfile);
app.patch("/bio", auth, user.updateBio);
app.patch("/privacy", auth, user.updatePrivacy);
app.delete("/account", auth, user.remove);

// FEED MOD
app.get("/feed", auth, group.get);

// GROUP MOD
app.post(
  "/group/create",
  auth,
  upload.fields([{ name: "image", maxCount: 1 }]),
  group.create
);
app.post("/group/join/:id", auth, group.join);
app.post("/group/leave/:id", auth, group.leave);
app.delete("/group/delete/:id", auth, group.deleteGroup);
app.get("/groups", auth, group.getAll);

// POST MOD
app.post("/group/post", auth, upload.array("images"), post.create);
app.get("/group/:groupid/post", auth, post.get);
app.post("/post/edit/:id", auth, post.edit); // Edit Post and Comment
app.delete("/post/:postid", auth, post.remove); // post
app.delete("/post/:postid/:id", auth, post.remove); // comment

// COMMENT/REPLY MOD
app.post("/post/:id/comment", auth, post.comment);
app.post("/post/:postid/:id/comment", auth, post.reply);

// REACTION MOD
app.post("/react/:postid", auth, post.reaction); // post
app.post("/react/:postid/:id", auth, post.reaction); //comment
// Remove Reaction MOD needs to be implemented

// BOOKMARK MOD
app.post("/bookmark/:postid", auth, post.bookmark);


// REPORT MOD
app.get("/report", auth, userLevel.required(constants.ADMIN), report.get);
app.post("/report/:postid", auth, post.report); // post
app.post("/report/:postid/:id", auth, post.report); //comment

// PROFILE MOD
app.get("/profile/:id", auth, profile.get);
app.post("/profile/:id/follow", auth, profile.follow);
app.post("/profile/:id/unfollow", auth, profile.unFollow);
app.post("/profile/:id/block", auth, profile.block);
app.post("/profile/:id/unblock", auth, profile.unblock);

// NOTIFICATIONS MOD
app.get("/notifications", auth, notification.get);
app.delete("/notifications", auth, notification.clear);

// MESSAGE MOD
app.get("/messages/:id", auth, messages.get); // messages with user (id)
app.post("/messages/:id", auth, messages.create); // send message to user(id)

if (process.env.NODE_ENV !== "test") {
  http.listen(port, () => {
    console.log(`listening on *:${port}`);
  });
}

module.exports = app;
