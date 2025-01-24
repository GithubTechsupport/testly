import axios from 'axios';

const fetchQuestions = () => {
  API_URL=process.env.REACT_APP_APIURL

  return axios.get('http://localhost:5000/api/questions').then((response) => {
    console.log(response.data)
    return response.data
  }).catch((err) => {
    console.log(err)
    return err
  })
};

export default fetchQuestions;