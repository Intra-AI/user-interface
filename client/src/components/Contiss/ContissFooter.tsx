import React from 'react';

interface ContissFooterProps {
  className?: string;
}

const ContissFooter: React.FC<ContissFooterProps> = ({ className = '' }) => {
  return (
    <footer className={`contiss-footer ${className}`}>
      <div className="contiss-footer-content">
        {/* Footer content will be added later */}
      </div>
    </footer>
  );
};

export default ContissFooter;
