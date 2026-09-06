from __future__ import annotations

from typing import Iterable


def binary_accuracy(y_true: Iterable[int], y_pred: Iterable[int]) -> float:
    pairs = list(zip(y_true, y_pred))
    if not pairs:
        return 0.0
    correct = sum(int(a == b) for a, b in pairs)
    return correct / len(pairs)


def positive_rate(values: Iterable[int]) -> float:
    values = list(values)
    if not values:
        return 0.0
    return sum(values) / len(values)
