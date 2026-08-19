# Architecture decision records

An ADR records a decision that was hard to make, along with the reasoning and
the alternatives that were rejected. The point is not documentation for its own
sake — it is so the same debate is not reopened every six months, and so
someone arriving later can tell a deliberate choice from an accident.

**Read this folder before making architectural choices.** Do not reverse a
decision here without writing a new ADR that supersedes it.

## Writing one

Copy `0000-template.md`, take the next free number, and fill it in. Numbers are
never reused, and an ADR is never deleted — a decision that no longer holds is
marked `Superseded by ADR-NNNN`, because the fact that it was once decided is
itself part of the record.

## Index

| ADR                                | Title                                                            | Status                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [0000](0000-template.md)           | Template                                                         | —                                                                                       |
| [0001](0001-distribution-model.md) | Distribution model                                               | Accepted                                                                                |
| [0002](0002-naming-and-prefix.md)  | Package naming and CSS custom property prefix                    | Accepted                                                                                |
| 0003                               | Token architecture: primitive / semantic / component             | **Reserved, not yet written — this gap is deliberate, do not decide it by implication** |
| [0004](0004-typescript-version.md) | Pin TypeScript to 6.x, and keep three non-default strict options | Accepted                                                                                |
