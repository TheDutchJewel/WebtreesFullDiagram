<?php

declare(strict_types=1);

namespace FullDiagram\Model;

use JsonSerializable;

class FamilyNode implements JsonSerializable
{
    /**
     * @param NodeData|null   $spouse
     * @param list<NodeData>  $children
     * @param string          $familyXref
     * @param list<NodeData>  $parents   Used in ancestor context (both parents)
     */
    public function __construct(
        private readonly ?NodeData $spouse,
        private readonly array     $children = [],
        private readonly string    $familyXref = '',
        private readonly array     $parents = [],
    ) {
    }

    public function jsonSerialize(): mixed
    {
        $data = [
            'familyXref' => $this->familyXref,
            'spouse'     => $this->spouse,
            'children'   => $this->children,
        ];

        if ($this->parents !== []) {
            $data['parents'] = $this->parents;
        }

        return $data;
    }
}
