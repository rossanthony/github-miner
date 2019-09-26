module.exports = {
    globals: {
        "ts-jest": {
            tsConfig: "tsconfig.json",
            diagnostics: false
        },
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
    collectCoverageFrom: [
        "<rootDir>/src/**/*.ts"
    ],
};