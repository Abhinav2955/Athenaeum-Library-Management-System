import {
  useEffect,
  useRef,
} from 'react';

export const useRealtimeChange = (
  versions,
  onChange
) => {
  const versionList =
    Array.isArray(versions)
      ? versions
      : [versions];

  const previousVersionsRef =
    useRef(versionList);

  const onChangeRef =
    useRef(onChange);

  useEffect(() => {
    onChangeRef.current =
      onChange;
  }, [
    onChange,
  ]);

  useEffect(() => {
    const previous =
      previousVersionsRef.current;

    const changed =
      versionList.some(
        (
          version,
          index
        ) =>
          version !==
          previous[index]
      );

    previousVersionsRef.current =
      versionList;

    if (!changed) {
      return;
    }

    onChangeRef.current();
  }, [
    ...versionList,
  ]);
};