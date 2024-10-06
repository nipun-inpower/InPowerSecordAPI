const request = require("supertest");
const app = require("../app");

// Mocking (fake) database behaviours
jest.mock("../models/users", () => ({
  search: jest.fn().mockImplementation((query) => {
    if (query.phoneNumber === "07847564983") {
      // Simulate successful database response
      return Promise.resolve({
        _id: "5345346346",
        phoneNumber: "07847564983",
        password: "f4k3h4$h3dp455", // "fakehash" as in showing what a hashed password with bcrypt might look like
      });
    } else {
      // Simulate user not found
      return Promise.resolve(null);
    }
  }),
}));

// Mocking bcrypt (fake password hashing)
const bcrypt = require("bcryptjs");
bcrypt.compare = jest
  .fn()
  .mockImplementation((sentPassword, storedPassword) => {
    return Promise.resolve(
      sentPassword === "password" && storedPassword === "f4k3h4$h3dp455"
    );
  });

describe("POST /auth/login", () => {
  it("should login when given the correct phoneNumber and password", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: "07847564983", password: "password" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toBeDefined();
    expect(response.body.msg).toEqual("Successful login.");
  });

  it("should not login for incorrect credentials", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: "07847564983", password: "wrongpassword" });

    expect(response.statusCode).toBe(400);
    expect(response.body.msg).toEqual("Invalid credentials.");
  });

  it("should return the right error when no phoneNumber is given", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ password: "password" });

    expect(response.statusCode).toBe(400);
    expect(response.body.msg).toEqual(
      "All required fields need to be entered."
    );
  });

  it("should return the right error when no password is given", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: "07847564983" });

    expect(response.statusCode).toBe(400);
    expect(response.body.msg).toEqual(
      "All required fields need to be entered."
    );
  });
});
