export interface RequestTicket {
  isCurrent: () => boolean;
}

export function createLatestRequestTracker() {
  let latestRequestId = 0;

  return {
    begin(): RequestTicket {
      const requestId = ++latestRequestId;
      return {
        isCurrent: () => requestId === latestRequestId,
      };
    },
  };
}
