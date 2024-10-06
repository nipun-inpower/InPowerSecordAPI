const request = require("supertest");
const app = require("../app");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const constants = require("../constants.js");

jest.mock("jsonwebtoken");
jest.mock("../models/users");
jest.mock("../models/post");

const userdb = require("../models/users");
const postdb = require("../models/post");

describe("GET /profile/:id", () => {
  it("should return a user profile and relevant data when provided a valid ID", async () => {
    const userId = new ObjectId();
    const profileId = new ObjectId();
    const mockToken = "mock-jwt-token";

    jwt.verify.mockReturnValue({ userid: userId }); // Mocking JWT verification to return the mock user ID

    // Mock/fake user that is viewing the profile
    const mockUser = {
      _id: userId,
      groups: ["group1"],
      following: [profileId],
      blockedBy: [],
      userType: constants.USER,
    };

    // Mock/fake profile of the user whose profile is being viewed
    const mockProfile = {
      _id: profileId,
      firstname: "testProfile",
      lastname: "testProfileLastName",
      followers: [userId],
      groups: ["group1"],
    };

    // Mock/fake posts by the user whose profile is being viewed to fill the profile feed
    const mockPosts = [
      {
        _id: new ObjectId(),
        title: "Test Post",
        author: { id: profileId },
        belongsTo: ["group1"],
      },
    ];

    userdb.search
      .mockResolvedValueOnce(mockUser) // Mock for the logged-in user
      .mockResolvedValueOnce(mockProfile); // Mock for the profile being accessed

    postdb.getAll.mockResolvedValue(mockPosts);

    const response = await request(app)
      .get(`/profile/${profileId}`)
      .set("Cookie", `token=${mockToken}`) // Using the mock token
      .expect(200);

    expect(response.body.profile).toBeDefined();
    expect(response.body.posts).toHaveLength(1);
    expect(response.body.mutualFollowers).toBeDefined();
  });
});
