import axios from 'axios';

const fetchQuestions = () => {
  return axios.get('http://localhost:5000/api/questions').then((response) => {
    console.log(response.data)
    return response.data
  }).catch((err) => {
    console.log(err)
    return err
  })
};

export default fetchQuestions;