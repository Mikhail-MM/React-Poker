import React from 'react';

function Handle({
  handle: { id, value, percent },
  getHandleProps
}) {
  return (
    <div
      style={{
        left: `${percent}%`,
        position: 'absolute',
        zIndex: 2,
        width: '15px',
        height: '15px',
        border: 0,
        textAlign: 'center',
        cursor: 'pointer',
        borderRadius: '50%',
        backgroundColor: 'red',
        color: 'red',
      }}
      {...getHandleProps(id)}
    >
      <div style={{ 
        display: 'flex', 
        textShadow: '2px 2px 8px rgba(0,0,0,0.95)', 
        justifyContent: 'center', 
        fontFamily: 'Roboto', 
        fontSize: '11px'
        }} >
        {value}
      </div>
    </div>

  )
}

export default Handle;