import { Track } from "poru";
import { ExtPlayer } from "../../Helpers/ExtendedClasses";
import { logger } from "../../Helpers/Logger";
import Event from "../../types/Event";

const TrackError: Event = {
  name: "trackError",
  once: false,
  execute: async (player: ExtPlayer, track: Track, error: Error) => {
    logger.error(`Error while playing track: ${error.stack}`);
  },
};

export default TrackError;
