import React from 'react';

function Track ({ source, target, getTrackProps }) {
  return(
    <div
    style={{
        position: 'absolute',
        height: 10,
        zIndex: 1,
        marginTop: 35,
        backgroundColor: '#546C91',
        borderRadius: 5,
        cursor: 'pointer',
        left: `${source.percent}%`,
        width: `${target.percent - source.percent}%`,
    }}
    {...getTrackProps()}
    />
  )
}
  
export default Track;