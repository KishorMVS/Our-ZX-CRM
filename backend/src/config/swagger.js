const swaggerJsdoc = require("swagger-jsdoc");
const richSpec = require("./redoc");

const options = {
    definition: richSpec,
    apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
