import { memo } from 'react';
import { Show } from '../App';
import { dateName, kbpsName, lengthName, quality, songCount, sourceWithChannel } from '../src/lib/specs';

interface ShowListProps {
  shows: Show[];
  /** Stable (App's handleShowClick), so the memo holds. */
  onShowClick: (show: Show) => void;
}

/**
 * The results as a dense list (docs/ux-research F10): one row per recording,
 * to scan an artist's run or reconcile it against a spreadsheet. Same shows,
 * same order as the grid; the layout toggle in the bar switches between them.
 *
 * A real table. Columns join as the screen widens: on a phone, date, the
 * artist with the event and place under it, and quality and length; from md,
 * event, place, quality, length; from lg, venue, PAL/NTSC and songs; from xl,
 * source, size (the show's own, else its folder's) and video bitrate. Copies of one show sit together whenever the sort is
 * by date. A row opens its show; its artist is the button, so the keyboard
 * reaches every row and focus comes back to it when the show closes.
 *
 * Memoised, and rendered only in list layout: never beside the grid.
 */
export const ShowList = memo(function ShowList({ shows, onShowClick }: ShowListProps) {
  return (
    <table className="w-full border-collapse text-left text-sm print:text-[11px] print:text-black">
      <thead className="text-xs uppercase tracking-[0.12em] text-gray-400 print:text-black">
        <tr className="border-b border-white/10 print:border-black/30">
          <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
          <th scope="col" className="py-2 pr-3 font-semibold">Artist</th>
          <th scope="col" className="hidden py-2 pr-3 font-semibold md:table-cell">Event</th>
          <th scope="col" className="hidden py-2 pr-3 font-semibold lg:table-cell print:table-cell">Venue</th>
          <th scope="col" className="hidden py-2 pr-3 font-semibold md:table-cell">Place</th>
          <th scope="col" className="hidden py-2 pr-3 font-semibold xl:table-cell print:table-cell">Source</th>
          <th scope="col" className="py-2 pr-3 font-semibold">Quality</th>
          <th scope="col" className="hidden py-2 pr-3 font-semibold lg:table-cell print:table-cell">Std</th>
          <th scope="col" className="hidden py-2 pr-3 text-right font-semibold md:table-cell">Length</th>
          <th scope="col" className="hidden py-2 pr-3 text-right font-semibold xl:table-cell print:table-cell">Size</th>
          <th scope="col" className="hidden py-2 pr-3 text-right font-semibold xl:table-cell print:table-cell">Video</th>
          <th scope="col" className="hidden py-2 text-right font-semibold lg:table-cell print:table-cell">Songs</th>
        </tr>
      </thead>
      <tbody>
        {shows.map(show => <Row key={show.ShowID} show={show} onShowClick={onShowClick} />)}
      </tbody>
    </table>
  );
});

function Row({ show, onShowClick }: { show: Show; onShowClick: (show: Show) => void }) {
  const q = quality(show)?.label ?? '';
  const length = lengthName(show.DurationSec);
  const place = [show.City, show.Country].filter(Boolean).join(', ');
  const kind = show.ContentType === 'Documentary' ? 'Documentary' : show.ParentShowID ? 'Excerpt' : '';
  const songs = songCount(show.Setlist);
  return (
    <tr
      // Anywhere on the row opens the show; focus moves to the row's button
      // first, so the drawer hands it back there on close.
      onClick={e => { e.currentTarget.querySelector('button')?.focus({ preventScroll: true }); onShowClick(show); }}
      className="cursor-pointer border-b border-white/6 align-top transition-colors duration-100 hover:bg-white/5 print:break-inside-avoid print:border-black/15"
    >
      <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-gray-300 print:text-black">{dateName(show)}</td>
      <td className="py-2 pr-3">
        <button
          type="button"
          className="cursor-pointer text-left font-medium text-white md:whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 print:text-black"
        >
          {show.Artist}
        </button>
        {/* On a phone the event and place sit under the artist. */}
        <span className="block text-xs text-gray-400 md:hidden">
          {[show.EventOrFestival || show.VenueName, show.City].filter(Boolean).join(' · ')}
        </span>
      </td>
      <td className="hidden py-2 pr-3 text-gray-200 md:table-cell print:text-black">
        {show.EventOrFestival}
        {kind && <span className="ml-1.5 text-xs text-gray-400 print:text-gray-600">{kind}</span>}
      </td>
      <td className="hidden py-2 pr-3 text-gray-300 lg:table-cell print:table-cell print:text-black">
        {show.VenueName !== show.EventOrFestival ? show.VenueName : ''}
      </td>
      <td className="hidden py-2 pr-3 text-gray-300 md:table-cell print:text-black">{place}</td>
      <td className="hidden whitespace-nowrap py-2 pr-3 text-gray-300 xl:table-cell print:table-cell print:text-black">{sourceWithChannel(show)}</td>
      <td className="whitespace-nowrap py-2 pr-3 text-gray-200 print:text-black">
        {q}
        <span className="block text-xs tabular-nums text-gray-400 md:hidden">{length}</span>
      </td>
      <td className="hidden py-2 pr-3 text-gray-300 lg:table-cell print:table-cell print:text-black">
        {quality(show)?.tier === 'hd' ? '' : show.TVStandard}
      </td>
      <td className="hidden whitespace-nowrap py-2 pr-3 text-right tabular-nums text-gray-200 md:table-cell print:text-black">{length}</td>
      <td className="hidden whitespace-nowrap py-2 pr-3 text-right tabular-nums text-gray-300 xl:table-cell print:table-cell print:text-black">{show.ShowSizeHuman || show.TotalSizeHuman}</td>
      <td className="hidden whitespace-nowrap py-2 pr-3 text-right tabular-nums text-gray-300 xl:table-cell print:table-cell print:text-black">{kbpsName(show.VideoKbps)}</td>
      <td className="hidden py-2 text-right tabular-nums text-gray-300 lg:table-cell print:table-cell print:text-black">{songs || ''}</td>
    </tr>
  );
}
