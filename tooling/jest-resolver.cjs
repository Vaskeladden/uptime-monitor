module.exports = (request, options) => {
  try {
    return options.defaultResolver(request, options);
  } catch (error) {
    if (!request.startsWith("@actions/")) {
      throw error;
    }
    return options.defaultResolver(request, {
      ...options,
      conditions: ["node", "import"],
    });
  }
};
