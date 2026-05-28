"""Local-first KBS SDK contract.

This module intentionally does not claim remote API readiness. Operators can
bind a transport when a governed API is deployed and verified.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class KbsClient:
    base_url: str | None = None

    def status(self) -> dict:
        return {
            "productionReady": False,
            "finalStatus": "GOVERNED_PRODUCTION_NO_GO",
            "reason": "Python SDK contract exists; governed remote transport is not verified.",
        }
