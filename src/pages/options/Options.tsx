import { getSettings } from '@src/scripts/settings';
import React from 'react';
import { Spinner, Stack } from 'react-bootstrap';

export default function Options(): JSX.Element {
  const [loading, setLoading] = React.useState(true);

  const init = async () => {
    const settings = await getSettings();
    setLoading(false);
  };
  React.useEffect(() => {
    if (!loading) return;
    init();
  }, [loading]);

  if (loading) {
    return <>Loading...&nbsp;
      <Spinner animation="border" role="status">
        <span className="visually-hidden">Loading...</span>
      </Spinner>
    </>;
  }

  return <div className="container">
    <Stack gap={2}>
    </Stack>
  </div>;
}
