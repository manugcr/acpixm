from typing import Callable


class LogicOps:
    """
    Stateless operations. Keep each op tiny and predictable.
    """

    @staticmethod
    def add(*numbers: int) -> int:
        return sum(numbers)

    @staticmethod
    def sub(*numbers: int) -> int:
        if not numbers:
            return 0
        total = numbers[0]
        for n in numbers[1:]:
            total -= n
        return total

    @staticmethod
    def gt(a: int, b: int) -> bool:
        return a > b

    @staticmethod
    def in_range(value: int, bounds: list[int]) -> bool:
        low, high = bounds
        if low > high:
            low, high = high, low
        return low <= value <= high

    @staticmethod
    def in_any_range(value: int, ranges: list[tuple]) -> bool:
        for start, end in ranges:
            if start <= value <= end:
                return True
        return False

    @staticmethod
    def overlaps(a: list[int], b: list[int]) -> bool:
        a0, a1 = (min(a[0], a[1]), max(a[0], a[1]))
        b0, b1 = (min(b[0], b[1]), max(b[0], b[1]))
        return max(a0, b0) <= min(a1, b1)

    @staticmethod
    def overlaps_any(a: list[int], ranges: list[list[int] | tuple]) -> bool:
        for r in ranges:
            r0, r1 = (min(r[0], r[1]), max(r[0], r[1]))
            a0, a1 = (min(a[0], a[1]), max(a[0], a[1]))
            if max(a0, r0) <= min(a1, r1):
                return True
        return False

    @staticmethod
    def make_range(start: int, length: int) -> list[int]:
        if length <= 0:
            return [start, start - 1]  # empty range
        end = start + length - 1
        return [min(start, end), max(start, end)]

    @staticmethod
    def and_op(*args: bool) -> bool:
        return all(args)

    @staticmethod
    def or_op(*args: bool) -> bool:
        return any(args)

    @staticmethod
    def registry() -> dict[str, Callable]:
        return {
            "add": LogicOps.add,
            "sub": LogicOps.sub,
            "gt": LogicOps.gt,
            "in-range": LogicOps.in_range,
            "in-any-range": LogicOps.in_any_range,
            "overlaps": LogicOps.overlaps,
            "overlaps-any": LogicOps.overlaps_any,
            "make-range": LogicOps.make_range,
            "and": LogicOps.and_op,
            "or": LogicOps.or_op,
        }
