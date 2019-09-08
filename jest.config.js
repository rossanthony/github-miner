module.exports = {
    roots: [
        "<rootDir>/tests"
    ],
    globals: {
        "ts-jest": {
            tsConfig: "tsconfig.json"
        }
    },
    moduleFileExtensions: [
        "ts",
        "js"
    ],
    transform: {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    testMatch: [
        "<rootDir>/tests/**/*.test.ts"
    ],
    testEnvironment: "node",
    collectCoverage: true,
};