import string
from unidecode import unidecode


def ceasar_cypher_encode(string_to_encode, cypher_shift):
    """Function receives a string to be encoded acording to Ceasar Cypher method ,
    and a integer as the cypher's shift. Returns the encoded string. Needs the string library,
    and unidecode package because Romans didnt have accentuation
    """

    alfabet_lower = string.ascii_lowercase
    alfabet_upper = string.ascii_uppercase

    string_to_encode = unidecode(string_to_encode)
    string_to_encode_lower = string_to_encode.lower()

    encoded = ""

    for index, value in enumerate(string_to_encode):

        if string_to_encode_lower[index] in string.punctuation:

            encoded = encoded + string_to_encode[index]

        else:

            position_in_alfabet_string = alfabet_lower.find(string_to_encode_lower[index])

            encoded_index = position_in_alfabet_string + cypher_shift

            if (position_in_alfabet_string + cypher_shift) >= len(alfabet_lower):
                encoded_index = encoded_index % len(alfabet_lower)

            if position_in_alfabet_string == -1:
                encoded = encoded + " "

            else:

                if string_to_encode[index].isupper():
                    encoded = encoded + alfabet_upper[encoded_index]
                else:    
                    encoded = encoded + alfabet_lower[encoded_index]            

    return encoded

def ceasar_cypher_decode(string_to_decode, cypher_shift):
    """Function receives an encoded string acording to Ceasar Cypher method ,
    and a integer as the cypher's shift. Returns the decoded string. Needs the string library,
    """

    alfabet_lower = string.ascii_lowercase
    alfabet_upper = string.ascii_uppercase

    string_to_decode_lower = string_to_decode.lower()

    decoded = ""

    for index, value in enumerate(string_to_decode_lower):
        position_in_alfabet_string = alfabet_lower.find(string_to_decode_lower[index])

        if string_to_decode[index] in string.punctuation:

            decoded = decoded + string_to_decode[index]

        else:

            decoded_index = position_in_alfabet_string - cypher_shift

            if (position_in_alfabet_string + cypher_shift) >= len(alfabet_lower):
                decoded_index = decoded_index % len(alfabet_lower)

            if (position_in_alfabet_string + cypher_shift) < 0:
                decoded_index = decoded_index + len(alfabet_lower) % 26

            if decoded_index == 26:
                decoded_index = 0

            if position_in_alfabet_string == -1:
                decoded = decoded + " "
            else:

                if string_to_decode[index].isupper():
                    decoded = decoded + alfabet_upper[decoded_index]
                else:    
                    decoded = decoded + alfabet_lower[decoded_index]                

    return decoded
