<?php

declare(strict_types=1);

namespace FullDiagram\Facade;

use Fisharebest\Webtrees\Individual;
use FullDiagram\Configuration;

/**
 * Builds a flat person array suitable for the family-chart library.
 *
 * Phase 1: Traverse the tree (ancestors + descendants) to collect individuals.
 * Phase 2: Build relationship data for each collected individual, filtering
 *          to only include relationships with other collected individuals.
 *
 * Output format per person (matches family-chart's expected structure):
 *   { id, data: { gender, "first name", "last name", ... }, rels: { parents, spouses, children } }
 */
class DataFacade
{
    /** @var array<string, Individual> Collected individuals keyed by xref */
    private array $individuals = [];

    public function buildFullTree(Individual $root, Configuration $configuration): array
    {
        $this->individuals = [];

        // Phase 1: Collect all individuals within configured depth
        $this->collectPerson($root);
        $this->collectAncestors($root, $configuration->ancestorGenerations(), $configuration->showSiblings());
        $this->collectDescendants($root, $configuration->descendantGenerations());

        // Phase 2: Build flat person array with bidirectional relationships
        $persons = [];
        foreach ($this->individuals as $individual) {
            $persons[] = $this->buildPersonData($individual);
        }

        return [
            'persons' => $persons,
            'mainId'  => $root->xref(),
        ];
    }

    private function collectPerson(Individual $individual): void
    {
        $this->individuals[$individual->xref()] = $individual;
    }

    private function collectAncestors(Individual $individual, int $generations, bool $showSiblings): void
    {
        if ($generations <= 0) {
            return;
        }

        foreach ($individual->childFamilies() as $family) {
            $husband = $family->husband();
            $wife    = $family->wife();

            if ($husband !== null && !isset($this->individuals[$husband->xref()])) {
                $this->collectPerson($husband);
                $this->collectAncestors($husband, $generations - 1, $showSiblings);
            }

            if ($wife !== null && !isset($this->individuals[$wife->xref()])) {
                $this->collectPerson($wife);
                $this->collectAncestors($wife, $generations - 1, $showSiblings);
            }

            // Collect siblings (other children of this family)
            if ($showSiblings) {
                foreach ($family->children() as $child) {
                    if (!isset($this->individuals[$child->xref()])) {
                        $this->collectPerson($child);
                        // One generation of descendants for siblings
                        $this->collectDescendants($child, 1);
                    }
                }
            }
        }
    }

    private function collectDescendants(Individual $individual, int $generations): void
    {
        if ($generations <= 0) {
            return;
        }

        foreach ($individual->spouseFamilies() as $family) {
            $spouse = $family->spouse($individual);
            if ($spouse !== null && !isset($this->individuals[$spouse->xref()])) {
                $this->collectPerson($spouse);
            }

            foreach ($family->children() as $child) {
                if (!isset($this->individuals[$child->xref()])) {
                    $this->collectPerson($child);
                    $this->collectDescendants($child, $generations - 1);
                }
            }
        }
    }

    /**
     * Build a single person entry in family-chart format.
     *
     * Relationships are filtered to only include collected individuals,
     * ensuring the graph is self-consistent.
     */
    private function buildPersonData(Individual $individual): array
    {
        $xref = $individual->xref();

        // Relationships — only to other collected individuals
        $parents  = [];
        $spouses  = [];
        $children = [];

        // Parents: from childFamilies
        foreach ($individual->childFamilies() as $family) {
            $husband = $family->husband();
            $wife    = $family->wife();

            if ($husband !== null && isset($this->individuals[$husband->xref()])) {
                $parents[] = $husband->xref();
            }
            if ($wife !== null && isset($this->individuals[$wife->xref()])) {
                $parents[] = $wife->xref();
            }
        }

        // Spouses and children: from spouseFamilies
        foreach ($individual->spouseFamilies() as $family) {
            $spouse = $family->spouse($individual);
            if ($spouse !== null && isset($this->individuals[$spouse->xref()])) {
                $spouses[] = $spouse->xref();
            }

            foreach ($family->children() as $child) {
                if (isset($this->individuals[$child->xref()])) {
                    $children[] = $child->xref();
                }
            }
        }

        // Extract personal data
        $names       = $individual->getAllNames();
        $primaryName = $names[0] ?? [];
        $firstName   = self::cleanGedcomName(trim($primaryName['givn'] ?? ''));
        $lastName    = self::cleanGedcomName(trim($primaryName['surn'] ?? ''));

        $thumbnailUrl = '';
        $media = $individual->findHighlightedMediaFile();
        if ($media !== null) {
            $thumbnailUrl = $media->imageUrl(80, 80, 'crop');
        }

        // Marriage date from first spouse family
        $marriageDate = '';
        $spouseFamily = $individual->spouseFamilies()->first();
        if ($spouseFamily !== null) {
            $marriageFact = $spouseFamily->facts(['MARR'])->first();
            if ($marriageFact !== null && $marriageFact->date()->isOK()) {
                $marriageDate = strip_tags($marriageFact->date()->display());
            }
        }

        // Check for ancestors/descendants beyond the current view
        $hasMoreAncestors = false;
        foreach ($individual->childFamilies() as $family) {
            if (($family->husband() !== null && !isset($this->individuals[$family->husband()->xref()])) ||
                ($family->wife() !== null && !isset($this->individuals[$family->wife()->xref()]))) {
                $hasMoreAncestors = true;
                break;
            }
        }

        $hasMoreDescendants = false;
        foreach ($individual->spouseFamilies() as $family) {
            foreach ($family->children() as $child) {
                if (!isset($this->individuals[$child->xref()])) {
                    $hasMoreDescendants = true;
                    break 2;
                }
            }
        }

        return [
            'id'   => $xref,
            'data' => [
                'gender'       => $individual->sex() === 'M' ? 'M' : 'F',
                'first name'   => $firstName,
                'last name'    => $lastName,
                'fullName'     => str_replace('@N.N.', "\u{2026}", strip_tags($individual->fullName())),
                'birthDate'    => self::extractDate($individual, 'BIRT'),
                'birthYear'    => self::extractYear($individual, 'BIRT'),
                'birthPlace'   => self::extractPlace($individual, 'BIRT'),
                'deathDate'    => self::extractDate($individual, 'DEAT'),
                'deathYear'    => self::extractYear($individual, 'DEAT'),
                'deathPlace'   => self::extractPlace($individual, 'DEAT'),
                'baptismDate'  => self::extractDate($individual, 'BAPM') ?: self::extractDate($individual, 'CHR'),
                'marriageDate' => $marriageDate,
                'occupation'   => self::extractFactValue($individual, 'OCCU'),
                'residence'    => self::extractFactValue($individual, 'RESI'),
                'isDead'       => $individual->isDead(),
                'avatar'       => $thumbnailUrl,
                'url'          => $individual->url(),
                'hasMoreAncestors'   => $hasMoreAncestors,
                'hasMoreDescendants' => $hasMoreDescendants,
            ],
            'rels' => [
                'parents'  => array_values(array_unique($parents)),
                'spouses'  => array_values(array_unique($spouses)),
                'children' => array_values(array_unique($children)),
            ],
        ];
    }

    private static function cleanGedcomName(string $name): string
    {
        if (preg_match('/^@[A-Z]\.N\.$/', $name)) {
            return '';
        }
        return $name;
    }

    private static function extractDate(Individual $individual, string $tag): string
    {
        $fact = $individual->facts([$tag])->first();
        if ($fact === null || !$fact->date()->isOK()) {
            return '';
        }
        return strip_tags($fact->date()->display());
    }

    private static function extractYear(Individual $individual, string $tag): string
    {
        $fact = $individual->facts([$tag])->first();
        if ($fact === null || !$fact->date()->isOK()) {
            return '';
        }
        return (string) $fact->date()->minimumDate()->year();
    }

    private static function extractPlace(Individual $individual, string $tag): string
    {
        $fact = $individual->facts([$tag])->first();
        if ($fact === null) {
            return '';
        }
        return $fact->place()->gedcomName();
    }

    private static function extractFactValue(Individual $individual, string $tag): string
    {
        $fact = $individual->facts([$tag])->first();
        if ($fact === null) {
            return '';
        }
        return trim($fact->value());
    }
}
