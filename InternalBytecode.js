/**
 * Hermes stack traces reference this virtual path; Metro tries to read it when symbolicating.
 * Providing an empty module avoids ENOENT noise in the dev server logs.
 */
module.exports = {};
