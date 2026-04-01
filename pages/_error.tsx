import { NextPageContext } from 'next'

interface ErrorProps {
  statusCode?: number
}

function Error({ statusCode }: ErrorProps) {
  return (
    <p style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      {statusCode ? `เกิดข้อผิดพลาด ${statusCode}` : 'เกิดข้อผิดพลาด'}
    </p>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
