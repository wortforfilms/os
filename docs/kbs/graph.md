# KBS Graph

Node types:

- SOURCE
- CLAIM
- DOMAIN
- CITATION
- EVIDENCE
- PERSON
- EVENT
- SCRIPT
- MANUSCRIPT
- ARTIFACT

Edge types:

- CITES
- SUPPORTS
- CONTRADICTS
- DERIVES_FROM
- BELONGS_TO
- TRANSLATES_TO
- VERIFIED_BY
- REVIEWED_BY

Graph validation fails closed when an edge points at a missing node.
