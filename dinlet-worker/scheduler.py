"""Ağır işler (Docling, TTS) için tek yuvalı, öncelikli kilit.

Tek container aynı CPU'yu paylaştığı için `extract` ve `tts` aynı anda
çalışmaz (doküman §6 "Kaynak limitleri"). Yuva boşaldığında bekleyenler
arasından önce `extract` alınır: kullanıcı ilk sonucu daha erken görür.
"""

import asyncio
import heapq
import itertools
from contextlib import asynccontextmanager

EXTRACT_PRIORITY = 0
TTS_PRIORITY = 1


class HeavyWorkSlot:
    def __init__(self) -> None:
        self._busy = False
        self._waiters: list[tuple[int, int, asyncio.Future[None]]] = []
        self._counter = itertools.count()

    @asynccontextmanager
    async def acquire(self, priority: int):
        if self._busy or self._waiters:
            future: asyncio.Future[None] = asyncio.get_running_loop().create_future()
            heapq.heappush(self._waiters, (priority, next(self._counter), future))
            try:
                await future
            except asyncio.CancelledError:
                if not future.done() or future.cancelled():
                    self._waiters = [w for w in self._waiters if w[2] is not future]
                    heapq.heapify(self._waiters)
                else:
                    self._release()
                raise
        self._busy = True
        try:
            yield
        finally:
            self._release()

    def _release(self) -> None:
        self._busy = False
        while self._waiters:
            _, _, future = heapq.heappop(self._waiters)
            if not future.done():
                # Yuva, uyandırılan bekleyene devredilir.
                self._busy = True
                future.set_result(None)
                return
