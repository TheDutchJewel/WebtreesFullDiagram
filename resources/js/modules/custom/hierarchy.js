/**
 * Dual-tree D3 hierarchy builder.
 *
 * Converts the PHP-generated tree data into two D3 hierarchies:
 * - Ancestor tree (root at bottom, growing upward)
 * - Descendant tree (root at top, growing downward)
 *
 * Both share the root node at (0, 0) and are merged for rendering.
 *
 * After D3 layout:
 *  1. Shift descendant subtrees so children center under the couple midpoint
 *  2. Compute spouse positions at every level
 *  3. Resolve all overlaps (person nodes, spouses, siblings) by pushing
 *     cards apart and propagating shifts to subtrees
 */
import { tree, hierarchy } from "../lib/d3.js";
import { computeSpouseOffset, SPOUSE_GAP } from "../lib/tree/spouse-util.js";

// ─── Ancestor hierarchy ──────────────────────────────────────────────

export function buildAncestorHierarchy(rootData) {
    if (!rootData.parents || rootData.parents.length === 0) {
        return null;
    }
    const root = prepareAncestorNode(rootData);
    return hierarchy(root, (d) => d._ancestorChildren);
}

function prepareAncestorNode(person) {
    const node = { ...person };
    if (person.parents && person.parents.length > 0) {
        node._ancestorChildren = person.parents.map((p) => prepareAncestorNode(p));
    }
    return node;
}

// ─── Descendant hierarchy ────────────────────────────────────────────

export function buildDescendantHierarchy(rootData) {
    if (!rootData.families || rootData.families.length === 0) {
        return null;
    }
    const root = prepareDescendantNode(rootData);
    return hierarchy(root, (d) => d._descendantChildren);
}

function prepareDescendantNode(person) {
    const node = { ...person };
    const children = [];

    if (person.families) {
        for (let fi = 0; fi < person.families.length; fi++) {
            const family = person.families[fi];
            for (const child of family.children || []) {
                const childNode = prepareDescendantNode(child);
                childNode._familyIndex = fi;
                children.push(childNode);
            }
        }
    }

    if (children.length > 0) {
        node._descendantChildren = children;
    }
    return node;
}

// ─── Layout computation ──────────────────────────────────────────────

export function computeLayout(ancestorHierarchy, descendantHierarchy, config) {
    const nodeWidth = config.cardWidth + config.horizontalSpacing;
    const nodeHeight = config.cardHeight + config.verticalSpacing;
    const treeLayout = tree().nodeSize([nodeWidth, nodeHeight]);

    const result = {
        ancestors: [],
        descendants: [],
        ancestorLinks: [],
        descendantLinks: [],
    };

    // ── Ancestor tree (grows upward) ──
    if (ancestorHierarchy) {
        treeLayout(ancestorHierarchy);

        ancestorHierarchy.each((node) => {
            node.y = -Math.abs(node.y);
            if (node.depth > 0) result.ancestors.push(node);
        });

        ancestorHierarchy.links().forEach((link) => {
            result.ancestorLinks.push(link);
        });
    }

    // ── Descendant tree (grows downward) ──
    if (descendantHierarchy) {
        treeLayout(descendantHierarchy);

        // Step 1: shift children to center under couple midpoints
        shiftChildrenToCoupleCenter(descendantHierarchy, config);

        // Step 2: resolve overlaps between all cards on the same row
        //         (person nodes + their spouse cards)
        resolveDescendantOverlaps(descendantHierarchy, config);

        descendantHierarchy.each((node) => {
            if (node.depth > 0) result.descendants.push(node);
        });

        descendantHierarchy.links().forEach((link) => {
            result.descendantLinks.push(link);
        });
    }

    return result;
}

// ─── Couple-center shifting ──────────────────────────────────────────

function shiftChildrenToCoupleCenter(root, config) {
    // Process bottom-up so nested shifts accumulate correctly
    root.each((node) => {
        const data = node.data;
        if (!data.families || data.families.length === 0 || !node.children) return;

        if (data.families.length === 1) {
            const family = data.families[0];
            if (family.spouse) {
                const shift = computeSpouseOffset(0, config.cardWidth, SPOUSE_GAP) / 2;
                for (const child of node.children) {
                    shiftSubtree(child, shift);
                }
            }
            return;
        }

        for (const child of node.children) {
            const fi = child.data._familyIndex;
            if (fi === undefined) continue;
            const family = data.families[fi];
            if (family && family.spouse) {
                const shift = computeSpouseOffset(fi, config.cardWidth, SPOUSE_GAP) / 2;
                shiftSubtree(child, shift);
            }
        }
    });
}

function shiftSubtree(node, dx) {
    node.x += dx;
    if (node.children) {
        for (const child of node.children) {
            shiftSubtree(child, dx);
        }
    }
}

// ─── Overlap resolution ──────────────────────────────────────────────

/**
 * Collect every card rectangle that will be rendered on each row
 * (person nodes + spouse cards), detect overlaps, and push apart.
 *
 * When a person node is pushed, its entire descendant subtree moves too.
 *
 * Strategy: for each depth row, build a sorted list of "card groups"
 * (a person + all their spouses form one rigid group). Then do a single
 * left-to-right sweep pushing groups apart when they overlap.
 */
function resolveDescendantOverlaps(root, config) {
    const w = config.cardWidth;
    const minGap = 20;

    // Gather hierarchy nodes by depth
    const depthMap = new Map();
    root.each((node) => {
        if (!depthMap.has(node.depth)) depthMap.set(node.depth, []);
        depthMap.get(node.depth).push(node);
    });

    const depths = [...depthMap.keys()].sort((a, b) => a - b);

    for (const depth of depths) {
        const nodesAtDepth = depthMap.get(depth);

        // Build card groups: each person node + their spouses as a rigid unit
        // A group has a leftEdge and rightEdge computed from all its cards.
        const groups = [];

        for (const node of nodesAtDepth) {
            const xs = [node.x]; // person card center

            const data = node.data;
            if (data.families) {
                for (let fi = 0; fi < data.families.length; fi++) {
                    if (data.families[fi].spouse) {
                        xs.push(node.x + computeSpouseOffset(fi, w, SPOUSE_GAP));
                    }
                }
            }

            const leftEdge = Math.min(...xs) - w / 2;
            const rightEdge = Math.max(...xs) + w / 2;

            groups.push({ node, leftEdge, rightEdge, centerX: node.x });
        }

        // Sort by the left edge of each group
        groups.sort((a, b) => a.leftEdge - b.leftEdge);

        // Single left-to-right sweep: push groups apart
        for (let i = 1; i < groups.length; i++) {
            const prev = groups[i - 1];
            const curr = groups[i];

            const overlap = prev.rightEdge + minGap - curr.leftEdge;

            if (overlap > 0) {
                // Push current group (and its subtree) right
                shiftSubtree(curr.node, overlap);
                curr.leftEdge += overlap;
                curr.rightEdge += overlap;
                curr.centerX += overlap;
            }
        }
    }
}

// ─── Sibling positions ───────────────────────────────────────────────

/**
 * Compute sibling positions at the same Y-level as root (0).
 *
 * Siblings are placed to the right of root. If the root has spouses,
 * siblings start after the rightmost spouse to avoid overlap.
 */
export function computeSiblingPositions(rootData, config) {
    const siblings = [];
    const links = [];

    if (!rootData.siblings || rootData.siblings.length === 0) {
        return { siblings, links };
    }

    // Find the rightmost occupied X at root level (root card + any spouses)
    let maxRootX = config.cardWidth / 2; // right edge of root card

    if (rootData.families) {
        for (let fi = 0; fi < rootData.families.length; fi++) {
            if (rootData.families[fi].spouse) {
                const spouseX = computeSpouseOffset(fi, config.cardWidth, SPOUSE_GAP);
                const spouseRight = spouseX + config.cardWidth / 2;
                maxRootX = Math.max(maxRootX, spouseRight);
            }
        }
    }

    const startX = maxRootX + config.siblingSpacing;

    rootData.siblings.forEach((sibling, index) => {
        const x = startX + index * (config.cardWidth + config.siblingSpacing);
        const y = 0;

        siblings.push({ x, y, data: sibling });
        links.push({ source: { x: 0, y: 0 }, target: { x, y } });
    });

    return { siblings, links };
}
