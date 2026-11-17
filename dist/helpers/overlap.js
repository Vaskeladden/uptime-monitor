/**
 * Get the overlap between two numbers
 */
export const checkOverlap = (a, b) => {
    const min = a.start < b.start ? a : b;
    const max = min.start === a.start && min.end === a.end ? b : a;
    if (min.end < max.start)
        return 0;
    return (min.end < max.end ? min.end : max.end) - max.start;
};
//# sourceMappingURL=overlap.js.map