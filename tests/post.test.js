const request = require("supertest");
const app = require("../app");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");

jest.mock("jsonwebtoken");
jest.mock("../models/post.js");
jest.mock("../models/comment.js");
jest.mock("../models/users.js");
jest.mock("../services/s3bucket.js", () => ({
  uploadFiles: jest.fn(() => Promise.resolve(["cookinggrouptestpic.png"])),
}));

describe("POST /group/post", () => {
  it("should successfully create a post when the user is authenticated and belongs to the specified groups", async () => {
    const mockUserId = new ObjectId();
    const mockToken = "mock-jwt-token";
    const mockPostId = new ObjectId();
    const groupIds = [new ObjectId(), new ObjectId()];

    require("../models/post.js").get.mockResolvedValue({
      _id: new ObjectId(),
      belongsTo: [new ObjectId().toString(), new ObjectId().toString()], // Mock 'belongsTo' with valid group IDs
    });

    // Mocking the userdb.search to return a user with groups that match the 'belongsTo'
    require("../models/users.js").search.mockResolvedValue({
      _id: new ObjectId(),
      groups: [new ObjectId().toString(), new ObjectId().toString()], // These should match 'belongsTo' in the post or comment mock
    });

    // Mocking user authentication
    jwt.verify.mockReturnValue({ userid: mockUserId.toString() });
    require("../models/users.js").search.mockResolvedValue({
      _id: mockUserId,
      groups: groupIds.map((id) => id.toString()),
      firstname: "User",
      lastname: "user",
      profileImageUrl: "cookinggrouptestpic.png",
      gender: "non-binary",
      verified: true,
    });
    require("../models/post.js").create.mockResolvedValue({
      postid: mockPostId,
    });

    const response = await request(app)
      .post("/group/post")
      .set("Cookie", `token=${mockToken}`)
      .send({
        content: "This is a test post",
        groupids: groupIds.map((id) => id.toString()),
        isAnonymous: false,
      })
      .expect(200);

    expect(response.body.msg).toEqual("Created post");
    expect(jwt.verify).toHaveBeenCalled();
  });
});
