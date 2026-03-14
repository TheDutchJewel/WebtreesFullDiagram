/**
 * Graphviz (viz.js) based family tree layout.
 *
 * Architecture: union-node pattern
 * ─────────────────────────────────
 * Each marriage/partnership is modeled as a small "union" node.
 *   parent1 ──→ union ──→ child1
 *   parent2 ──→ union ──→ child2
 *
 * Graphviz's "dot" algorithm (Sugiyama) then places:
 *   - Each generation on its own rank
 *   - Union nodes on intermediate ranks between parents and children
 *   - Couples side-by-side (connected to the same union)
 *   - Children centered below the union node
 *
 * The layout guarantees no overlaps and handles multiple marriages,
 * siblings, and complex family structures correctly.
 */
import { instance as vizInstance } from "@viz-js/viz";

let viz = null;

async function getViz() {
    if (!viz) {
        viz = await vizInstance();
    }
    return viz;
}

// Graphviz uses inches; 1 inch = 72 points
const PPI = 72;

/**
 * Build a Graphviz DOT graph from the tree data and compute layout.
 *
 * @param {object} rootData - The root person data from PHP
 * @param {Configuration} config
 * @returns {Promise<LayoutResult>} Positioned nodes and edges
 */
export async function computeGraphvizLayout(rootData, config) {
    const builder = new GraphBuilder(config);
    builder.addPersonFromData(rootData);
    const dot = builder.buildDotGraph();

    const viz = await getViz();
    const result = viz.renderJSON(dot);

    return extractPositions(result, builder, config);
}

// ─── Graph Builder ───────────────────────────────────────────────────

class GraphBuilder {
    constructor(config) {
        this.config = config;
        this.nodes = new Map(); // id → { id, type, data, layer }
        this.edges = []; // { source, target }
        this.visited = new Set();
        this.unionCounter = 0;
    }

    /**
     * Recursively add a person and all their relatives to the graph.
     */
    addPersonFromData(data, currentLayer = 0) {
        if (this.visited.has(data.xref)) return;
        this.visited.add(data.xref);

        this.addPersonNode(data, currentLayer);

        // Ancestors: go up via parentFamilies
        if (data.parentFamilies && data.parentFamilies.length > 0) {
            this.addAncestorFamilies(data, currentLayer);
        }

        // Descendants: go down
        if (data.families && data.families.length > 0) {
            this.addDescendants(data, currentLayer);
        }
    }

    addPersonNode(data, layer) {
        if (this.nodes.has(data.xref)) return;
        this.nodes.set(data.xref, {
            id: data.xref,
            type: "person",
            data: data,
            layer: layer,
        });
    }

    addUnionNode(layer) {
        const id = `union_${this.unionCounter++}`;
        this.nodes.set(id, {
            id: id,
            type: "union",
            data: null,
            layer: layer,
        });
        return id;
    }

    addEdge(source, target) {
        const exists = this.edges.some(
            (e) => e.source === source && e.target === target
        );
        if (!exists) {
            this.edges.push({ source, target });
        }
    }

    /**
     * Add ancestor families: each parentFamily is a FamilyNode with
     * .parents (both mother & father) and .children (siblings).
     *
     * Creates: parent → union → child (for each child including the person)
     */
    addAncestorFamilies(personData, personLayer) {
        const parentFamilies = personData.parentFamilies;
        if (!parentFamilies || parentFamilies.length === 0) return;

        for (const family of parentFamilies) {
            const unionLayer = personLayer - 1;
            const parentLayer = personLayer - 2;
            const unionId = this.addUnionNode(unionLayer);

            // Union → person (this child)
            this.addEdge(unionId, personData.xref);

            // Each parent → union, then recurse into their ancestors
            for (const parent of family.parents || []) {
                this.addPersonNode(parent, parentLayer);
                this.addEdge(parent.xref, unionId);

                if (!this.visited.has(parent.xref)) {
                    this.visited.add(parent.xref);
                    if (
                        parent.parentFamilies &&
                        parent.parentFamilies.length > 0
                    ) {
                        this.addAncestorFamilies(parent, parentLayer);
                    }
                }
            }

            // Siblings (other children of this family) → same union
            for (const sibling of family.children || []) {
                this.addPersonNode(sibling, personLayer);
                this.addEdge(unionId, sibling.xref);

                // Process sibling's descendants
                if (!this.visited.has(sibling.xref)) {
                    this.visited.add(sibling.xref);
                    if (sibling.families && sibling.families.length > 0) {
                        this.addDescendants(sibling, personLayer);
                    }
                }
            }
        }
    }

    /**
     * Add descendant chain: person → union → children
     */
    addDescendants(personData, personLayer) {
        if (!personData.families) return;

        for (const family of personData.families) {
            const unionLayer = personLayer + 1;
            const childLayer = personLayer + 2;
            const unionId = this.addUnionNode(unionLayer);

            // Person → union
            this.addEdge(personData.xref, unionId);

            // Spouse → union
            if (family.spouse) {
                this.addPersonNode(family.spouse, personLayer);
                this.addEdge(family.spouse.xref, unionId);
            }

            // Union → each child
            for (const child of family.children || []) {
                this.addPersonNode(child, childLayer);
                this.addEdge(unionId, child.xref);

                // Recurse into child's descendants
                if (!this.visited.has(child.xref)) {
                    this.visited.add(child.xref);
                    if (child.families && child.families.length > 0) {
                        this.addDescendants(child, childLayer);
                    }
                }
            }
        }
    }

    /**
     * Build a Graphviz DOT language graph.
     */
    buildDotGraph() {
        const w = this.config.cardWidth / PPI;
        const h = this.config.cardHeight / PPI;
        const nodesep = this.config.horizontalSpacing / PPI;
        const ranksep = this.config.verticalSpacing / PPI;

        let dot = "digraph G {\n";
        dot += "  rankdir=TB;\n";
        dot += `  nodesep=${nodesep.toFixed(3)};\n`;
        dot += `  ranksep=${ranksep.toFixed(3)};\n`;
        dot += "  splines=none;\n";
        dot += "  ordering=out;\n";
        dot += "\n";

        // Add nodes
        for (const [id, node] of this.nodes) {
            // Escape quotes in IDs
            const safeId = id.replace(/"/g, '\\"');
            if (node.type === "person") {
                dot += `  "${safeId}" [shape=box, fixedsize=true, width=${w.toFixed(3)}, height=${h.toFixed(3)}];\n`;
            } else {
                dot += `  "${safeId}" [shape=point, width=0.01, height=0.01];\n`;
            }
        }

        dot += "\n";

        // Add edges
        for (const edge of this.edges) {
            const src = edge.source.replace(/"/g, '\\"');
            const tgt = edge.target.replace(/"/g, '\\"');
            dot += `  "${src}" -> "${tgt}";\n`;
        }

        dot += "\n";

        // Add rank constraints to group nodes at the same layer
        const layerGroups = new Map();
        for (const [id, node] of this.nodes) {
            const layer = node.layer;
            if (!layerGroups.has(layer)) layerGroups.set(layer, []);
            layerGroups.get(layer).push(id);
        }

        for (const [, ids] of layerGroups) {
            if (ids.length > 1) {
                const quoted = ids
                    .map((id) => `"${id.replace(/"/g, '\\"')}"`)
                    .join("; ");
                dot += `  { rank=same; ${quoted}; }\n`;
            }
        }

        dot += "}\n";
        return dot;
    }
}

// ─── Extract results ─────────────────────────────────────────────────

/**
 * Parse a Graphviz "x,y" position string into {x, y} in pixels.
 * Graphviz Y-axis goes bottom-to-top, so we negate Y for SVG (top-to-bottom).
 */
function parsePos(posStr) {
    const parts = posStr.split(",");
    return { x: parseFloat(parts[0]), y: -parseFloat(parts[1]) };
}

/**
 * Extract node positions from Graphviz and build family connections ourselves.
 *
 * We IGNORE Graphviz's edge routing entirely. Instead we use node positions
 * and the graph structure to draw clean family-tree connectors:
 *
 *   Parent1    Parent2
 *      |          |
 *      +----+-----+        ← horizontal couple bar
 *           |
 *     ------+------        ← horizontal children bus
 *     |   |   |   |
 *    C1  C2  C3  C4
 *
 * This gives merged, clean orthogonal lines at consistent heights.
 *
 * @returns {LayoutResult}
 */
function extractPositions(gvResult, builder, config) {
    const persons = [];
    const unions = [];
    const connections = []; // family connections, not raw edges

    // Map node names to their Graphviz positions
    const nodePositions = new Map(); // name → { x, y }

    let rootX = 0;
    let rootY = 0;

    // First pass: collect all positions, find root
    for (const obj of gvResult.objects || []) {
        if (!obj.name || !obj.pos) continue;
        const nodeInfo = builder.nodes.get(obj.name);
        if (!nodeInfo) continue;

        const pos = parsePos(obj.pos);
        nodePositions.set(obj.name, pos);

        if (
            nodeInfo.type === "person" &&
            nodeInfo.data &&
            nodeInfo.data.isRoot
        ) {
            rootX = pos.x;
            rootY = pos.y;
        }
    }

    const halfW = config.cardWidth / 2;
    const halfH = config.cardHeight / 2;

    // Second pass: build positioned nodes centered on root
    for (const [name, pos] of nodePositions) {
        const nodeInfo = builder.nodes.get(name);
        if (!nodeInfo) continue;

        const cx = pos.x - rootX;
        const cy = pos.y - rootY;

        if (nodeInfo.type === "person") {
            persons.push({
                x: cx,
                y: cy,
                data: nodeInfo.data,
            });
        } else {
            unions.push({
                id: name,
                x: cx,
                y: cy,
            });
        }
    }

    // Third pass: build family connections from graph structure.
    // For each union node, find its parents (edges INTO it) and
    // children (edges OUT of it), then build connector paths.
    const incomingToUnion = new Map(); // unionId → [nodeId, ...]
    const outgoingFromUnion = new Map(); // unionId → [nodeId, ...]

    for (const edge of builder.edges) {
        const sourceInfo = builder.nodes.get(edge.source);
        const targetInfo = builder.nodes.get(edge.target);

        if (targetInfo && targetInfo.type === "union") {
            // person → union (parent/spouse)
            if (!incomingToUnion.has(edge.target))
                incomingToUnion.set(edge.target, []);
            incomingToUnion.get(edge.target).push(edge.source);
        }

        if (sourceInfo && sourceInfo.type === "union") {
            // union → person (child)
            if (!outgoingFromUnion.has(edge.source))
                outgoingFromUnion.set(edge.source, []);
            outgoingFromUnion.get(edge.source).push(edge.target);
        }
    }

    // For each union, generate clean family-tree connector paths
    for (const [unionId, union] of unions.map((u) => [u.id, u])) {
        const parents = (incomingToUnion.get(unionId) || [])
            .map((id) => {
                const pos = nodePositions.get(id);
                return pos
                    ? { id, x: pos.x - rootX, y: pos.y - rootY }
                    : null;
            })
            .filter(Boolean);

        const children = (outgoingFromUnion.get(unionId) || [])
            .map((id) => {
                const pos = nodePositions.get(id);
                return pos
                    ? { id, x: pos.x - rootX, y: pos.y - rootY }
                    : null;
            })
            .filter(Boolean);

        const ux = union.x;
        const uy = union.y;

        // --- Parent-to-union connections ---
        // Each parent drops a vertical line from card bottom to the union Y,
        // then a horizontal bar connects them at union Y.
        if (parents.length > 0) {
            // Horizontal couple bar at union Y
            if (parents.length >= 2) {
                const xs = parents.map((p) => p.x).sort((a, b) => a - b);
                connections.push({
                    path: `M ${xs[0]} ${uy} L ${xs[xs.length - 1]} ${uy}`,
                    cssClass: "link couple-link",
                });
            }

            // Vertical drops from each parent's bottom edge to couple bar
            for (const p of parents) {
                const bottomY = p.y + halfH;
                connections.push({
                    path: `M ${p.x} ${bottomY} L ${p.x} ${uy}`,
                    cssClass: "link ancestor-link",
                });
            }
        }

        // --- Union-to-children connections ---
        // Vertical line from union down to bus Y, horizontal bus spanning
        // all children, then vertical drops from bus to each child's top.
        if (children.length > 0) {
            // Bus Y is halfway between union and the first child row
            const childY = children[0].y;
            const busY = uy + (childY - halfH - uy) / 2;

            // Vertical stem from union (or couple bar) down to bus
            connections.push({
                path: `M ${ux} ${uy} L ${ux} ${busY}`,
                cssClass: "link descendant-link",
            });

            if (children.length === 1) {
                // Single child: just continue the vertical line
                connections.push({
                    path: `M ${children[0].x} ${busY} L ${children[0].x} ${childY - halfH}`,
                    cssClass: "link descendant-link",
                });
            } else {
                // Horizontal bus spanning all children
                const xs = children
                    .map((c) => c.x)
                    .sort((a, b) => a - b);
                connections.push({
                    path: `M ${xs[0]} ${busY} L ${xs[xs.length - 1]} ${busY}`,
                    cssClass: "link descendant-link",
                });

                // Vertical drops from bus to each child's top edge
                for (const c of children) {
                    connections.push({
                        path: `M ${c.x} ${busY} L ${c.x} ${childY - halfH}`,
                        cssClass: "link descendant-link",
                    });
                }
            }
        }
    }

    return { persons, unions, connections };
}
