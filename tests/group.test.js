const request = require("supertest");
const app = require("../app");
const jwt = require("jsonwebtoken");
jest.mock("../models/group");
jest.mock("jsonwebtoken");
jest.mock("../models/users");
const path = require("path");

const groupdb = require("../models/group");
const userdb = require("../models/users");

groupdb.join.mockResolvedValue({ modifiedCount: 1 });

describe("Group Tests", () => {
  describe("POST /group/create and POST /group/join/:id", () => {
    it("should create a group when fields are filled correctly, and the group should be joined successfully", async () => {
      // faking/mocking a userid, token, groupid
      const userId = 23485;
      const mockToken = "mock-jwt-token";
      const mockGroupId = "new-group-id";
      // mocking jwt and making sure user is authenticated since endpoints require auth
      jwt.verify.mockReturnValue({ userid: userId });
      jwt.sign.mockReturnValue(mockToken);

      groupdb.create.mockResolvedValue({ groupid: mockGroupId });
      userdb.search.mockResolvedValue({
        _id: userId,
        groups: [mockGroupId],
      });

      const response = await request(app)
        .post("/group/create")
        .set("Cookie", `token=${mockToken}`)
        .field("name", "Cooking")
        .field("description", "Let's all cook together")
        .attach("image", path.join(__dirname, "cookinggrouptestpic.png"))
        .expect(200);

      console.log(response.body.msg);
      expect(response.body.msg).toBe("Successfully created group");

      // Instead of having to write a separate test for joining a group, it gets indirectly tested here thanks to creators of groups automatically
      // being joined upon group creation.
      const userGroups = await userdb.search({ _id: userId });
      console.log(userGroups);
      expect(userGroups.groups).toContain(mockGroupId);
    });
  });
});
