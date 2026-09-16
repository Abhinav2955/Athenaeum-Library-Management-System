let ioInstance = null;

const setIO = (io) => {
  ioInstance = io;
};

const getIO = () => ioInstance;

const emitDataChanged = (
  {
    resources,
    userId = null,
    staff = false,
    authenticated = false,
  },
  transaction = null
) => {
  const resourceList = Array.isArray(
    resources
  )
    ? resources
    : [resources];

  const cleanResources =
    resourceList.filter(Boolean);

  if (
    cleanResources.length === 0
  ) {
    return;
  }

  const emit = () => {
    const io = getIO();

    if (!io) {
      return;
    }

    let target = null;

    if (userId) {
      target = io.to(
        `user:${userId}`
      );
    }

    if (staff) {
      target = target
        ? target.to('staff')
        : io.to('staff');
    }

    if (authenticated) {
      target = target
        ? target.to(
            'authenticated'
          )
        : io.to(
            'authenticated'
          );
    }

    if (!target) {
      return;
    }

    target.emit(
      'data_changed',
      {
        resources:
          cleanResources,
        timestamp:
          new Date().toISOString(),
      }
    );
  };

  if (
    transaction &&
    typeof transaction.afterCommit ===
      'function'
  ) {
    transaction.afterCommit(
      emit
    );

    return;
  }

  emit();
};

module.exports = {
  setIO,
  getIO,
  emitDataChanged,
};