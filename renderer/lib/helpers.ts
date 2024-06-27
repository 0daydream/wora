import axios from "axios";
import { IAudioMetadata } from "music-metadata";
import { useState, useEffect } from "react";

interface MetadataResponse {
  metadata: IAudioMetadata;
  art: string;
  favourite: boolean;
}

export const fetchLyrics = async (query: string, duration: number) => {
  try {
    const response = await axios.get("https://lrclib.net/api/search", {
      params: { q: query },
    });

    const songs = response.data;

    const matchedSongs = songs.filter(
      (song: any) =>
        Math.abs(song.duration - duration) <= 5 &&
        (song.syncedLyrics !== null || song.plainLyrics !== null),
    );

    if (matchedSongs.length === 0) {
      return null;
    }

    matchedSongs.sort((a: any, b: any) => {
      if (a.syncedLyrics && !b.syncedLyrics) {
        return -1;
      } else if (!a.syncedLyrics && b.syncedLyrics) {
        return 1;
      } else {
        return 0;
      }
    });

    if (matchedSongs[0].syncedLyrics) {
      return matchedSongs[0].syncedLyrics;
    } else if (matchedSongs[0].plainLyrics) {
      return matchedSongs[0].plainLyrics;
    }
  } catch (error) {
    return null;
  }
};

export const fetchMetadata = async (
  file: string,
): Promise<MetadataResponse> => {
  let metadata: IAudioMetadata | null;
  let art: string;
  let favourite: boolean;

  if (file) {
    await window.ipc
      .invoke("getSongMetadata", file)
      .then((response) => {
        metadata = response.metadata;
        art = response.art;
        favourite = response.favourite;
      })
      .catch((error) => {
        console.log("Error fetching metadata:", error.message);
      });
  } else {
    metadata = null;
    art = "/coverArt.png";
    favourite = false;
  }

  return { metadata, art, favourite };
};

interface DiscordState {
  details: string;
  state?: string;
  timestamp?: boolean;
}

const defaultState: DiscordState = {
  details: "Idle...",
  timestamp: true,
};

export const updateDiscordState = (metadata: any): void => {
  if (!metadata) {
    return;
  }

  const details = `${metadata.common.title} → ${metadata.common.album}`;
  const state = `by ${metadata.common.artist}`;

  window.ipc.send("set-rpc-state", { details, state });
};

export const resetDiscordState = (): void => {
  window.ipc.send("set-rpc-state", defaultState);
};

export const useAudioMetadata = (file: string) => {
  const [metadata, setMetadata] = useState<IAudioMetadata | null>(null);
  const [cover, setCover] = useState<string | null>("/coverArt.png");
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [favourite, setFavourite] = useState<boolean>(false);

  useEffect(() => {
    const getData = async () => {
      try {
        const response = await fetchMetadata(file);
        setMetadata(response.metadata);
        setCover(response.art);
        if (response.metadata) {
          const fetchedLyrics = await fetchLyrics(
            `${response.metadata.common.title} ${response.metadata.common.artist}`,
            response.metadata.format.duration,
          );

          setLyrics(fetchedLyrics);
        }
        setFavourite(response.favourite);
      } catch (error) {
        console.error("Failed to fetch metadata: ", error.message);
      }
    };

    getData();
  }, [file]);

  return { metadata, cover, lyrics, favourite };
};

interface LyricLine {
  time: number;
  text: string;
}

export const convertTime = (seconds: number) => {
  const convertedSeconds = Math.round(seconds);
  const minutes = Math.floor(convertedSeconds / 60);
  const remainingSeconds = convertedSeconds % 60;
  // Pad seconds with leading zero if less than 10
  const formattedSeconds = remainingSeconds.toString().padStart(2, "0");
  return `${minutes}:${formattedSeconds}`;
};

export const parseLyrics = (lyrics: string): LyricLine[] => {
  return lyrics
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\] (.*)$/);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseFloat(match[2]);
        const time = minutes * 60 + seconds - 1; // 1s offset to make sure the lyrics are displayed before the actual time;
        let text = match[3].trim();
        if (text === "") {
          text = "...";
        }
        return { time, text };
      }
      return null;
    })
    .filter((line) => line !== null) as LyricLine[];
};

export const isSyncedLyrics = (lyrics: string): boolean => {
  return /\[\d{2}:\d{2}\.\d{2}\]/.test(lyrics);
};

export const shuffleArray = (array: any[]): any[] => {
  const newArray = array.slice();
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};
