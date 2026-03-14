/**
 * Data loading and management.
 */
export default class DataLoader {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    /**
     * Load tree data for a specific individual via AJAX.
     *
     * @param {string} xref
     * @param {object} params
     * @returns {Promise<object>}
     */
    async load(xref, params = {}) {
        const url = new URL(this.baseUrl.replace("__XREF__", xref), window.location.origin);
        url.searchParams.set("ajax", "1");

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }

        const response = await fetch(url.toString(), {
            headers: { Accept: "application/json" },
        });

        if (!response.ok) {
            throw new Error(`Failed to load data: ${response.status}`);
        }

        const result = await response.json();
        return result.data;
    }

    /**
     * Navigate to a person's chart page.
     *
     * @param {string} xref
     */
    navigateTo(xref) {
        window.location.href = this.baseUrl.replace("__XREF__", xref);
    }
}
