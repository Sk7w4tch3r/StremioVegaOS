import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {EpisodeCatalog} from '../src/components/EpisodeCatalog';

it('opens on the current episode page and navigates seasons, specials and pages', () => {
  const videos = [0, 1, 2].flatMap((season) =>
    Array.from({length: 14}, (_, i) => ({
      id: season + ':' + (i + 1),
      title: 'Episode ' + (i + 1),
      episode: i + 1,
      season,
    })),
  );
  const choose = jest.fn();
  const ui = render(
    <EpisodeCatalog videos={videos} currentId="2:14" choose={choose} />,
  );
  expect(ui.getByText('Page 2 of 2')).toBeTruthy();
  fireEvent.press(ui.getByLabelText('Previous episode page'));
  fireEvent.press(ui.getByText('1.  Episode 1'));
  expect(choose).toHaveBeenCalledWith('2:1');
  fireEvent.press(ui.getByLabelText('Previous season'));
  fireEvent.press(ui.getByText(/Season 1.*▾/));
  fireEvent.press(ui.getByText('Specials'));
  fireEvent.press(ui.getByLabelText('Next episode page'));
  fireEvent.press(ui.getByText('13.  Episode 13'));
  expect(choose).toHaveBeenCalledWith('0:13');
});

it('finds episodes across seasons and resets pagination for a new search', () => {
  const choose = jest.fn();
  const ui = render(
    <EpisodeCatalog
      videos={[
        {id: 'a', title: 'Pilot', season: 1, episode: 1},
        {id: 'b', title: 'The Return', season: 3, episode: 7},
      ]}
      currentId="a"
      choose={choose}
    />,
  );
  fireEvent.changeText(ui.getByLabelText('Search all episodes'), 'return');
  fireEvent.press(ui.getByText('S3 E7.  The Return'));
  expect(choose).toHaveBeenCalledWith('b');
  fireEvent.changeText(ui.getByLabelText('Search all episodes'), 'none');
  expect(ui.getByText('No matching episodes')).toBeTruthy();
});
