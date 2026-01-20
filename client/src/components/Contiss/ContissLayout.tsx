import React from 'react';
import ContissHeader from './ContissHeader';
import ContissFooter from './ContissFooter';

interface ContissLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
}

const ContissLayout: React.FC<ContissLayoutProps> = ({
  children,
  showHeader = true,
  showFooter = true,
}) => {
  return (
    <div className="contiss-layout">
      {showHeader && <ContissHeader />}
      <main className="contiss-main-content">
        <div className="contiss-main-inner">{children}</div>
      </main>
      {showFooter && <ContissFooter />}
    </div>
  );
};

export default ContissLayout;
