import { getSiteSlug } from "./slug";
describe("site slug generation", () => {
    it("keeps Unicode-only site names addressable when no explicit slug is set", () => {
        expect(getSiteSlug({ name: "鸭鸭梨", url: "https://example.com" })).toBe("鸭鸭梨");
    });
    it("preserves existing ASCII slug behavior", () => {
        expect(getSiteSlug({ name: "Wikipedia", url: "https://wikipedia.org" })).toBe("wikipedia");
    });
    it("prefers an explicit configured slug", () => {
        expect(getSiteSlug({ name: "鸭鸭梨", slug: "duck-pear", url: "https://example.com" })).toBe("duck-pear");
    });
    it("falls back to the site URL if the name cannot produce a slug", () => {
        expect(getSiteSlug({ name: "///", url: "https://example.com/path" })).toBe("https-example-com-path");
    });
});
//# sourceMappingURL=slug.spec.js.map